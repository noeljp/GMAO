const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

// Get all resources
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { type, is_active = 'true' } = req.query;
  
  let query = `
    SELECT r.*, rt.nom as type_nom, rt.type as type_categorie,
           u.prenom || ' ' || u.nom as utilisateur_nom
    FROM resources r
    LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
    LEFT JOIN utilisateurs u ON r.utilisateur_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (is_active !== 'all') {
    query += ` AND r.is_active = $${paramIndex}`;
    params.push(is_active === 'true');
    paramIndex++;
  }

  if (type) {
    query += ` AND rt.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  query += ' ORDER BY r.nom';

  const result = await pool.query(query, params);
  res.json({ data: result.rows });
}));

// Get resource by ID
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT r.*, rt.nom as type_nom, rt.type as type_categorie,
           u.prenom || ' ' || u.nom as utilisateur_nom
    FROM resources r
    LEFT JOIN resource_types rt ON r.resource_type_id = rt.id
    LEFT JOIN utilisateurs u ON r.utilisateur_id = u.id
    WHERE r.id = $1
  `, [req.params.id]);

  if (result.rows.length === 0) {
    throw new AppError('Ressource non trouvée', 404);
  }

  res.json(result.rows[0]);
}));

// Create resource
router.post('/', authenticate, [
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('code').trim().notEmpty().withMessage('Code requis'),
  body('resource_type_id').isUUID().withMessage('Type de ressource invalide'),
  body('quantite_disponible').optional().isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation échouée', 400, errors.array());
  }

  const { nom, code, description, resource_type_id, utilisateur_id, quantite_disponible } = req.body;
  
  const result = await pool.query(
    `INSERT INTO resources (nom, code, description, resource_type_id, utilisateur_id, quantite_disponible)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [nom, code, description, resource_type_id, utilisateur_id, quantite_disponible || 1]
  );

  res.status(201).json(result.rows[0]);
}));

// Update resource
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { nom, description, quantite_disponible, is_active } = req.body;
  
  const result = await pool.query(
    `UPDATE resources 
     SET nom = COALESCE($1, nom),
         description = COALESCE($2, description),
         quantite_disponible = COALESCE($3, quantite_disponible),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [nom, description, quantite_disponible, is_active, req.params.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Ressource non trouvée', 404);
  }

  res.json(result.rows[0]);
}));

// Check resource availability
router.post('/check-availability', authenticate, [
  body('resource_id').isUUID().withMessage('ID ressource invalide'),
  body('date_debut').isISO8601().withMessage('Date de début invalide'),
  body('date_fin').isISO8601().withMessage('Date de fin invalide'),
  body('quantite_requise').optional().isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation échouée', 400, errors.array());
  }

  const { resource_id, date_debut, date_fin, quantite_requise = 1, exclude_allocation_id } = req.body;

  const result = await pool.query(
    `SELECT * FROM check_resource_conflict($1, $2, $3, $4, $5)`,
    [resource_id, date_debut, date_fin, quantite_requise, exclude_allocation_id || null]
  );

  const conflicts = result.rows;
  const hasConflict = conflicts.length > 0;

  res.json({
    available: !hasConflict,
    conflicts: conflicts.map(c => ({
      allocation_id: c.conflicting_allocation_id,
      ordre_id: c.conflicting_ordre_id,
      ordre_titre: c.conflicting_ordre_titre
    }))
  });
}));

// Get resource allocations
router.get('/:id/allocations', authenticate, asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT ra.*, ot.titre as ordre_titre, ot.statut as ordre_statut,
           ot.priorite as ordre_priorite
    FROM resource_allocations ra
    LEFT JOIN ordres_travail ot ON ra.ordre_travail_id = ot.id
    WHERE ra.resource_id = $1
  `;
  const params = [req.params.id];
  let paramIndex = 2;

  if (start_date) {
    query += ` AND ra.date_fin >= $${paramIndex}`;
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    query += ` AND ra.date_debut <= $${paramIndex}`;
    params.push(end_date);
    paramIndex++;
  }

  query += ' ORDER BY ra.date_debut';

  const result = await pool.query(query, params);
  res.json({ data: result.rows });
}));

// Get resource types
router.get('/types/list', authenticate, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM resource_types WHERE is_active = true ORDER BY type, nom'
  );
  res.json({ data: result.rows });
}));

module.exports = router;
