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

    const countResult = await pool.query('SELECT COUNT(*) FROM demandes_intervention WHERE is_active = true');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT d.*,
             u.prenom || ' ' || u.nom as demandeur_nom,
             a.code_interne as actif_code
      FROM demandes_intervention d
      LEFT JOIN utilisateurs u ON d.demandeur_id = u.id
      LEFT JOIN actifs a ON d.actif_id = a.id
      WHERE d.is_active = true
      ORDER BY d.created_at DESC
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

    const { titre, description, actif_id, priorite, type } = req.body;
    const result = await pool.query(
      `INSERT INTO demandes_intervention (titre, description, actif_id, priorite, type, demandeur_id, statut, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'soumise', NOW(), NOW())
       RETURNING *`,
      [titre, description, actif_id, priorite, type, req.user.id]
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
