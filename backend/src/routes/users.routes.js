const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { body, validationResult } = require('express-validator');

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

// Create new user
router.post('/',
  authenticate,
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('prenom').notEmpty().withMessage('Le prénom est requis'),
    body('nom').notEmpty().withMessage('Le nom est requis'),
    body('role').isIn(['admin', 'manager', 'technicien', 'user']).withMessage('Rôle invalide'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, prenom, nom, role } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM utilisateurs WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Cet email est déjà utilisé', 400);
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, prenom, nom, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, prenom, nom, role, is_active, created_at`,
      [email, hashedPassword, prenom, nom, role]
    );

    res.status(201).json(result.rows[0]);
  })
);

// Update user
router.patch('/:id',
  authenticate,
  [
    body('email').optional().isEmail().withMessage('Email invalide'),
    body('prenom').optional().notEmpty().withMessage('Le prénom ne peut pas être vide'),
    body('nom').optional().notEmpty().withMessage('Le nom ne peut pas être vide'),
    body('role').optional().isIn(['admin', 'manager', 'technicien', 'user']).withMessage('Rôle invalide'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { email, prenom, nom, role, password } = req.body;

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query('SELECT id FROM utilisateurs WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      throw new AppError('Utilisateur non trouvé', 404);
    }

    // Si l'email est modifié, vérifier qu'il n'est pas déjà utilisé
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM utilisateurs WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new AppError('Cet email est déjà utilisé', 400);
      }
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (prenom) {
      updates.push(`prenom = $${paramIndex++}`);
      values.push(prenom);
    }
    if (nom) {
      updates.push(`nom = $${paramIndex++}`);
      values.push(nom);
    }
    if (role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      throw new AppError('Aucune modification fournie', 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE utilisateurs
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, prenom, nom, role, is_active, created_at, updated_at`,
      values
    );

    res.json(result.rows[0]);
  })
);

// Delete user (soft delete)
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query('SELECT id, email FROM utilisateurs WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      throw new AppError('Utilisateur non trouvé', 404);
    }

    // Empêcher la suppression de son propre compte
    if (id === req.user.id) {
      throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
    }

    // Soft delete
    await pool.query(
      'UPDATE utilisateurs SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'Utilisateur supprimé avec succès' });
  })
);


module.exports = router;
