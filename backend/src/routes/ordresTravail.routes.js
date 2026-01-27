const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { executeTransition, getAvailableTransitions, getWorkflowHistory } = require('../config/workflow');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

// Get all ordres de travail
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    // Support filtering by date range, type, priority, resource
    const { date_debut_min, date_fin_max, type, priorite, resource_id, statut } = req.query;

    let whereConditions = ['ot.is_active = true', '(ot.is_confidential = false OR ot.created_by = $1)'];
    let queryParams = [req.user.id];
    let paramIndex = 2;
    
    if (date_debut_min) {
      whereConditions.push(`ot.date_prevue_debut >= $${paramIndex}`);
      queryParams.push(date_debut_min);
      paramIndex++;
    }
    
    if (date_fin_max) {
      whereConditions.push(`ot.date_prevue_fin <= $${paramIndex}`);
      queryParams.push(date_fin_max);
      paramIndex++;
    }
    
    if (type) {
      whereConditions.push(`ot.type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }
    
    if (priorite) {
      whereConditions.push(`ot.priorite = $${paramIndex}`);
      queryParams.push(priorite);
      paramIndex++;
    }
    
    if (statut) {
      whereConditions.push(`ot.statut = $${paramIndex}`);
      queryParams.push(statut);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ordres_travail ot WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    let query = `
      SELECT ot.*,
             a.code_interne as actif_code,
             a.description as actif_nom,
             u.prenom || ' ' || u.nom as technicien_nom,
             ot.date_prevue_debut as date_prevue_display
      FROM ordres_travail ot
      LEFT JOIN actifs a ON ot.actif_id = a.id
      LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
    `;
    
    if (resource_id) {
      query += `
        INNER JOIN resource_allocations ra ON ot.id = ra.ordre_travail_id
      `;
      whereConditions.push(`ra.resource_id = $${paramIndex}`);
      queryParams.push(resource_id);
      paramIndex++;
    }
    
    query += ` WHERE ${whereConditions.join(' AND ')}
      ORDER BY COALESCE(ot.date_prevue_debut, ot.created_at) DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching OT:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des ordres de travail' });
  }
});

// Create OT with resource allocation
router.post('/', authenticate, [
  body('titre').trim().notEmpty().withMessage('Titre requis'),
  body('actif_id').notEmpty().withMessage('Actif requis'),
  body('type').notEmpty().withMessage('Type requis'),
  body('duree_estimee').optional().isInt({ min: 1 })
], async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const { 
      titre, description, actif_id, type, priorite, technicien_id,
      date_prevue_debut, date_prevue_fin,
      duree_estimee, resources, is_confidential 
    } = req.body;
    
    // Calculate date_prevue_fin if not provided but duree_estimee is
    let finalDateDebut = date_prevue_debut;
    let finalDateFin = date_prevue_fin;
    
    if (finalDateDebut && duree_estimee && !finalDateFin) {
      const debut = new Date(finalDateDebut);
      finalDateFin = new Date(debut.getTime() + duree_estimee * 60000).toISOString();
    }

    const result = await client.query(
      `INSERT INTO ordres_travail (
        titre, description, actif_id, type, priorite, technicien_id,
        date_prevue_debut, date_prevue_fin,
        duree_estimee, is_confidential, statut, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en_attente', $11, NOW(), NOW())
      RETURNING *`,
      [titre, description, actif_id, type, priorite, technicien_id,
       finalDateDebut, finalDateFin,
       duree_estimee, is_confidential || false, req.user.id]
    );

    const ordreId = result.rows[0].id;
    
    // Allocate resources if provided
    if (resources && Array.isArray(resources) && resources.length > 0) {
      for (const resource of resources) {
        // Check for conflicts
        const conflictCheck = await client.query(
          `SELECT * FROM check_resource_conflict($1, $2, $3, $4, NULL)`,
          [resource.resource_id, finalDateDebut, finalDateFin, resource.quantite_requise || 1]
        );
        
        if (conflictCheck.rows.length > 0) {
          // Mark the order as having conflicts
          await client.query(
            `UPDATE ordres_travail 
             SET has_conflicts = true, 
                 conflict_details = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify({ conflicts: conflictCheck.rows }), ordreId]
          );
        }
        
        // Create allocation even if there's a conflict (can be resolved later)
        await client.query(
          `INSERT INTO resource_allocations (
            ordre_travail_id, resource_id, quantite_requise,
            date_debut, date_fin, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [ordreId, resource.resource_id, resource.quantite_requise || 1,
           finalDateDebut, finalDateFin, req.user.id]
        );
      }
    }

    await client.query('COMMIT');
    
    // Fetch the complete order with relationships
    const finalResult = await pool.query(`
      SELECT ot.*,
             a.code_interne as actif_code,
             a.description as actif_nom,
             u.prenom || ' ' || u.nom as technicien_nom
      FROM ordres_travail ot
      LEFT JOIN actifs a ON ot.actif_id = a.id
      LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
      WHERE ot.id = $1
    `, [ordreId]);
    
    res.status(201).json(finalResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating OT:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'ordre de travail' });
  } finally {
    client.release();
  }
});

// ==========================================
// ROUTES SPÉCIFIQUES (AVANT /:id)
// ==========================================

// Transition de statut avec workflow
router.patch('/:id/transition', 
  authenticate,
  [
    body('nouveau_statut').notEmpty().withMessage('Le nouveau statut est requis'),
    body('commentaire').optional()
  ],
  asyncHandler(async (req, res) => {
    console.log('=== ROUTE TRANSITION CALLED ===', req.params.id);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { nouveau_statut, commentaire } = req.body;
    const result = await executeTransition({
      userId: req.user.id,
      entite: 'ot',
      entiteId: req.params.id,
      nouveauStatut: nouveau_statut,
      commentaire,
      metadata: req.body.metadata || {}
    });

    // Récupérer les transitions disponibles pour l'état suivant
    const transitions = await getAvailableTransitions(req.user.id, 'ot', nouveau_statut);
    
    res.json({
      ...result,
      available_transitions: transitions
    });
  })
);

// Obtenir les transitions disponibles pour un OT
router.get('/:id/transitions', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT statut FROM ordres_travail WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Ordre de travail non trouvé', 404);
    }

    const transitions = await getAvailableTransitions(
      req.user.id, 
      'ot', 
      result.rows[0].statut
    );
    
    res.json({ transitions });
  })
);

// Historique des transitions
router.get('/:id/history', 
  authenticate,
  asyncHandler(async (req, res) => {
    const history = await getWorkflowHistory('ot', req.params.id);
    res.json({ data: history });
  })
);

// Get resource allocations for an order
router.get('/:id/resources',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT ra.*, r.nom as resource_nom, r.code as resource_code,
             rt.nom as resource_type_nom, rt.type as resource_type_categorie
      FROM resource_allocations ra
      LEFT JOIN resources r ON ra.resource_id = r.id
      LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
      WHERE ra.ordre_travail_id = $1
      ORDER BY ra.created_at
    `, [req.params.id]);
    
    res.json({ data: result.rows });
  })
);

// Add resource allocation to an order
router.post('/:id/resources',
  authenticate,
  [
    body('resource_id').isUUID().withMessage('ID ressource invalide'),
    body('quantite_requise').optional().isInt({ min: 1 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { resource_id, quantite_requise = 1, notes } = req.body;
    
    // Get order dates
    const orderResult = await pool.query(
      'SELECT date_prevue_debut, date_prevue_fin FROM ordres_travail WHERE id = $1',
      [req.params.id]
    );
    
    if (orderResult.rows.length === 0) {
      throw new AppError('Ordre de travail non trouvé', 404);
    }
    
    const order = orderResult.rows[0];
    const dateDebut = order.date_prevue_debut;
    const dateFin = order.date_prevue_fin;
    
    if (!dateDebut || !dateFin) {
      throw new AppError('L\'ordre de travail doit avoir des dates définies', 400);
    }
    
    // Check for conflicts
    const conflictCheck = await pool.query(
      `SELECT * FROM check_resource_conflict($1, $2, $3, $4, NULL)`,
      [resource_id, dateDebut, dateFin, quantite_requise]
    );
    
    let hasConflicts = conflictCheck.rows.length > 0;
    
    // Create allocation
    const result = await pool.query(
      `INSERT INTO resource_allocations (
        ordre_travail_id, resource_id, quantite_requise,
        date_debut, date_fin, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [req.params.id, resource_id, quantite_requise, dateDebut, dateFin, notes, req.user.id]
    );
    
    // Update order conflict status if needed
    if (hasConflicts) {
      await pool.query(
        `UPDATE ordres_travail 
         SET has_conflicts = true,
             conflict_details = COALESCE(conflict_details, '{}'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ resource_conflicts: conflictCheck.rows }), req.params.id]
      );
    }
    
    res.status(201).json({
      allocation: result.rows[0],
      conflicts: hasConflicts ? conflictCheck.rows : []
    });
  })
);

// Update OT dates and check for conflicts
router.patch('/:id/schedule',
  authenticate,
  [
    body('date_prevue_debut').optional().isISO8601(),
    body('date_prevue_fin').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { date_prevue_debut, date_prevue_fin } = req.body;
    
    // Get current allocations
    const allocationsResult = await pool.query(
      'SELECT id, resource_id, quantite_requise FROM resource_allocations WHERE ordre_travail_id = $1',
      [req.params.id]
    );
    
    // Update order dates
    await pool.query(
      `UPDATE ordres_travail 
       SET date_prevue_debut = COALESCE($1, date_prevue_debut),
           date_prevue_fin = COALESCE($2, date_prevue_fin),
           updated_at = NOW(),
           updated_by = $3
       WHERE id = $4`,
      [date_prevue_debut, date_prevue_fin, req.user.id, req.params.id]
    );
    
    // Update all allocations and check for conflicts
    let hasConflicts = false;
    const allConflicts = [];
    
    for (const allocation of allocationsResult.rows) {
      await pool.query(
        `UPDATE resource_allocations
         SET date_debut = $1, date_fin = $2, updated_at = NOW()
         WHERE id = $3`,
        [date_prevue_debut, date_prevue_fin, allocation.id]
      );
      
      const conflictCheck = await pool.query(
        `SELECT * FROM check_resource_conflict($1, $2, $3, $4, $5)`,
        [allocation.resource_id, date_prevue_debut, date_prevue_fin, 
         allocation.quantite_requise, allocation.id]
      );
      
      if (conflictCheck.rows.length > 0) {
        hasConflicts = true;
        allConflicts.push(...conflictCheck.rows);
      }
    }
    
    // Update conflict status
    await pool.query(
      `UPDATE ordres_travail 
       SET has_conflicts = $1,
           conflict_details = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [hasConflicts, hasConflicts ? JSON.stringify({ conflicts: allConflicts }) : null, req.params.id]
    );
    
    res.json({ 
      success: true,
      has_conflicts: hasConflicts,
      conflicts: allConflicts
    });
  })
);

// Ancienne route de mise à jour de statut - deprecated
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { statut } = req.body;
    const result = await pool.query(
      `UPDATE ordres_travail
       SET statut = $1, updated_by = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [statut, req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ordre de travail non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating OT status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

// ==========================================
// ROUTE GÉNÉRIQUE (DOIT ÊTRE EN DERNIER)
// ==========================================

// Get OT by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ot.*,
             a.code_interne as actif_code,
             a.description as actif_description,
             u.prenom || ' ' || u.nom as technicien_nom
      FROM ordres_travail ot
      LEFT JOIN actifs a ON ot.actif_id = a.id
      LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
      WHERE ot.id = $1 AND (ot.is_confidential = false OR ot.created_by = $2)
    `, [req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ordre de travail non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching OT:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'ordre de travail' });
  }
});

module.exports = router;
