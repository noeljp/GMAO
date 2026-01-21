const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

// Get actifs types
router.get('/types', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM actifs_types ORDER BY nom');
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching actifs types:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des types' });
  }
});

// Get all actifs with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { site_id, type_id, statut_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) FROM actifs a WHERE a.is_active = true';
    let query = `
      SELECT a.*, 
             s.nom as site_nom,
             at.nom as type_nom,
             ast.nom as statut_nom
      FROM actifs a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN actifs_types at ON a.type_id = at.id
      LEFT JOIN actifs_statuts ast ON a.statut_id = ast.id
      WHERE a.is_active = true
    `;
    const params = [];
    
    if (site_id) {
      params.push(site_id);
      query += ` AND a.site_id = $${params.length}`;
      countQuery += ` AND a.site_id = $${params.length}`;
    }
    if (type_id) {
      params.push(type_id);
      query += ` AND a.type_id = $${params.length}`;
      countQuery += ` AND a.type_id = $${params.length}`;
    }
    if (statut_id) {
      params.push(statut_id);
      query += ` AND a.statut_id = $${params.length}`;
      countQuery += ` AND a.statut_id = $${params.length}`;
    }

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    query += ' ORDER BY a.code_interne LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
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
    console.error('Error fetching actifs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des actifs' });
  }
});

// Get actif by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
             s.nom as site_nom,
             at.nom as type_nom,
             ast.nom as statut_nom,
             ac.nom as criticite_nom
      FROM actifs a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN actifs_types at ON a.type_id = at.id
      LEFT JOIN actifs_statuts ast ON a.statut_id = ast.id
      LEFT JOIN actifs_criticites ac ON a.criticite_id = ac.id
      WHERE a.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Actif non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching actif:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'actif' });
  }
});

// Create actif
router.post('/', authenticate, [
  body('site_id').notEmpty().withMessage('Site requis'),
  body('code_interne').trim().notEmpty().withMessage('Code interne requis'),
  body('type_id').notEmpty().withMessage('Type requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { site_id, code_interne, numero_serie, description, type_id, statut_id, criticite_id } = req.body;
    const result = await pool.query(
      `INSERT INTO actifs (site_id, code_interne, numero_serie, description, type_id, statut_id, criticite_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [site_id, code_interne, numero_serie, description, type_id, statut_id, criticite_id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating actif:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'actif' });
  }
});

module.exports = router;
