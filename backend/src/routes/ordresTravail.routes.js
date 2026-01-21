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

    const countResult = await pool.query('SELECT COUNT(*) FROM ordres_travail WHERE is_active = true');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT ot.*,
             a.code_interne as actif_code,
             u.prenom || ' ' || u.nom as technicien_nom
      FROM ordres_travail ot
      LEFT JOIN actifs a ON ot.actif_id = a.id
      LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
      WHERE ot.is_active = true
      ORDER BY ot.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

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
      WHERE ot.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ordre de travail non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching OT:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'ordre de travail' });
  }
});

// Create OT
router.post('/', authenticate, [
  body('titre').trim().notEmpty().withMessage('Titre requis'),
  body('actif_id').notEmpty().withMessage('Actif requis'),
  body('type').notEmpty().withMessage('Type requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { titre, description, actif_id, type, priorite, technicien_id } = req.body;
    const result = await pool.query(
      `INSERT INTO ordres_travail (titre, description, actif_id, type, priorite, technicien_id, statut, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'planifie', $7, NOW(), NOW())
       RETURNING *`,
      [titre, description, actif_id, type, priorite, technicien_id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating OT:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'ordre de travail' });
  }
});

// Update OT status
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
      entite: 'ordre_travail',
      entiteId: req.params.id,
      nouveauStatut: nouveau_statut,
      commentaire,
      metadata: req.body.metadata || {}
    });

    // Récupérer les transitions disponibles pour l'état suivant
    const transitions = await getAvailableTransitions(req.user.id, 'ordre_travail', nouveau_statut);
    
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
      'ordre_travail', 
      result.rows[0].statut
    );
    
    res.json({ transitions });
  })
);

// Historique des transitions
router.get('/:id/history', 
  authenticate,
  asyncHandler(async (req, res) => {
    const history = await getWorkflowHistory('ordre_travail', req.params.id);
    res.json({ data: history });
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

module.exports = router;
