const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

// Get all users
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM utilisateurs WHERE is_active = true');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT id, email, prenom, nom, role, is_active, created_at
      FROM utilisateurs
      WHERE is_active = true
      ORDER BY nom, prenom
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
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, prenom, nom, role, is_active, created_at FROM utilisateurs WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
  }
});

module.exports = router;
