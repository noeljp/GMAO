const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get all sites
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM sites WHERE is_active = true');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT id, code, nom, adresse, timezone, is_active, created_at
      FROM sites
      WHERE is_active = true
      ORDER BY nom
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
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sites' });
  }
});

// Get site by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sites WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching site:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du site' });
  }
});

// Create site
router.post('/', authenticate, authorize('admin'), [
  body('code').trim().notEmpty().withMessage('Code requis'),
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('timezone').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, nom, adresse, timezone } = req.body;
    const result = await pool.query(
      `INSERT INTO sites (code, nom, adresse, timezone, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [code, nom, adresse, timezone, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Erreur lors de la création du site' });
  }
});

// Update site
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { code, nom, adresse, timezone } = req.body;
    const result = await pool.query(
      `UPDATE sites
       SET code = $1, nom = $2, adresse = $3, timezone = $4, updated_by = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [code, nom, adresse, timezone, req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du site' });
  }
});

// Delete site (soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sites SET is_active = false, updated_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }
    res.json({ message: 'Site supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du site' });
  }
});

module.exports = router;
