const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { executeTransition, getAvailableTransitions, getWorkflowHistory } = require('../config/workflow');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

// Get all demandes
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM demandes_intervention WHERE is_active = true AND (is_confidential = false OR demandeur_id = $1)',
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT d.*,
             u.prenom || ' ' || u.nom as demandeur_nom,
             a.code_interne as actif_code
      FROM demandes_intervention d
      LEFT JOIN utilisateurs u ON d.demandeur_id = u.id
      LEFT JOIN actifs a ON d.actif_id = a.id
      WHERE d.is_active = true AND (d.is_confidential = false OR d.demandeur_id = $1)
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

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
    console.error('Error fetching demandes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des demandes' });
  }
});

// Create demande
router.post('/', authenticate, [
  body('titre').trim().notEmpty().withMessage('Titre requis'),
  body('actif_id').notEmpty().withMessage('Actif requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { titre, description, actif_id, priorite, type, is_confidential } = req.body;
    const result = await pool.query(
      `INSERT INTO demandes_intervention (titre, description, actif_id, priorite, type, demandeur_id, is_confidential, statut, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'soumise', NOW(), NOW())
       RETURNING *`,
      [titre, description, actif_id, priorite, type, req.user.id, is_confidential || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating demande:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la demande' });
  }
});

// Transition de statut avec workflow
router.patch('/:id/transition', 
  authenticate,
  [
    body('nouveau_statut').notEmpty().withMessage('Le nouveau statut est requis'),
    body('commentaire').optional()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { nouveau_statut, commentaire } = req.body;
    const result = await executeTransition({
      userId: req.user.id,
      entite: 'demande',
      entiteId: req.params.id,
      nouveauStatut: nouveau_statut,
      commentaire,
      metadata: req.body.metadata || {}
    });

    // Récupérer les transitions disponibles
    const transitions = await getAvailableTransitions(req.user.id, 'demande', nouveau_statut);
    
    res.json({
      ...result,
      available_transitions: transitions
    });
  })
);

// Update demande (modification des informations)
router.patch('/:id', authenticate, [
  body('titre').optional().trim().notEmpty().withMessage('Titre ne peut pas être vide'),
  body('actif_id').optional().notEmpty().withMessage('Actif requis si fourni')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { titre, description, actif_id, priorite, type, is_confidential } = req.body;
    
    // Construire dynamiquement la requête UPDATE
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (titre !== undefined) {
      updates.push(`titre = $${paramIndex++}`);
      values.push(titre);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (actif_id !== undefined) {
      updates.push(`actif_id = $${paramIndex++}`);
      values.push(actif_id);
    }
    if (priorite !== undefined) {
      updates.push(`priorite = $${paramIndex++}`);
      values.push(priorite);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (is_confidential !== undefined) {
      updates.push(`is_confidential = $${paramIndex++}`);
      values.push(is_confidential);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);
    values.push(req.params.id);

    const query = `
      UPDATE demandes_intervention 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex + 1} AND is_active = true AND (is_confidential = false OR demandeur_id = $${paramIndex})
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating demande:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la demande' });
  }
});

// Get demande by ID (doit être après les routes spécifiques)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
             u.prenom || ' ' || u.nom as demandeur_nom,
             a.code_interne as actif_code
      FROM demandes_intervention d
      LEFT JOIN utilisateurs u ON d.demandeur_id = u.id
      LEFT JOIN actifs a ON d.actif_id = a.id
      WHERE d.id = $1 AND d.is_active = true AND (d.is_confidential = false OR d.demandeur_id = $2)
    `, [req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }
    
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching demande:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la demande' });
  }
});

// Delete demande (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE demandes_intervention 
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND is_active = true AND (is_confidential = false OR demandeur_id = $2)
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }
    
    res.json({ message: 'Demande supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting demande:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la demande' });
  }
});

// Obtenir les transitions disponibles
router.get('/:id/transitions', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT statut FROM demandes_intervention WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Demande non trouvée', 404);
    }

    const transitions = await getAvailableTransitions(
      req.user.id, 
      'demande', 
      result.rows[0].statut
    );
    
    res.json({ transitions });
  })
);

// Historique des transitions
router.get('/:id/history', 
  authenticate,
  asyncHandler(async (req, res) => {
    const history = await getWorkflowHistory('demande', req.params.id);
    res.json({ data: history });
  })
);

module.exports = router;
