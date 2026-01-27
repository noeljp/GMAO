const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const pool = require('../config/database');
const { logAudit } = require('../config/audit');
const logger = require('../config/logger');
const { body, validationResult } = require('express-validator');

// Middleware pour vérifier le rôle admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Accès refusé. Droits administrateur requis.' });
  }
  next();
};

// =====================================================
// GESTION DES TYPES D'ACTIFS
// =====================================================

/**
 * @route GET /api/types-actifs
 * @desc Lister tous les types d'actifs avec leurs champs
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ta.id,
        ta.nom,
        ta.description,
        ta.created_at,
        (SELECT COUNT(*) FROM actifs WHERE type_id = ta.id) as nb_actifs,
        (SELECT json_agg(json_build_object(
          'id', acd.id,
          'nom', acd.nom,
          'libelle', acd.libelle,
          'type_champ', acd.type_champ,
          'unite', acd.unite,
          'description', acd.description,
          'ordre', acd.ordre,
          'obligatoire', acd.obligatoire,
          'is_active', acd.is_active
        ) ORDER BY acd.ordre, acd.libelle)
        FROM actifs_champs_definition acd
        WHERE acd.type_actif_id = ta.id AND acd.is_active = true
        ) as champs
      FROM actifs_types ta
      WHERE ta.is_active = true
      ORDER BY ta.nom`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error getting types actifs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des types d\'actifs' });
  }
});

/**
 * @route GET /api/types-actifs/:id
 * @desc Obtenir un type d'actif avec ses champs
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        ta.id,
        ta.nom,
        ta.description,
        ta.created_at
      FROM actifs_types ta
      WHERE ta.id = $1 AND ta.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Type d\'actif non trouvé' });
    }

    // Récupérer les champs
    const champsResult = await pool.query(
      `SELECT 
        id,
        nom,
        libelle,
        type_champ,
        unite,
        description,
        ordre,
        obligatoire,
        is_active
      FROM actifs_champs_definition
      WHERE type_actif_id = $1 AND is_active = true
      ORDER BY ordre, libelle`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        champs: champsResult.rows
      }
    });

  } catch (error) {
    logger.error('Error getting type actif:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du type d\'actif' });
  }
});

// =====================================================
// GESTION DES CHAMPS DE DÉFINITION (COMPTEURS)
// =====================================================

/**
 * @route POST /api/types-actifs/:typeId/champs
 * @desc Créer un nouveau champ pour un type d'actif (ex: compteur)
 */
router.post('/:typeId/champs',
  authenticate,
  requireAdmin,
  [
    body('nom').trim().notEmpty().withMessage('Le nom du champ est requis'),
    body('libelle').trim().notEmpty().withMessage('Le libellé est requis'),
    body('type_champ').isIn(['text', 'number', 'date', 'boolean', 'select'])
      .withMessage('Type de champ invalide'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { typeId } = req.params;
      const { nom, libelle, type_champ, unite, description, ordre, obligatoire } = req.body;

      // Vérifier que le type d'actif existe
      const typeExists = await pool.query(
        'SELECT id FROM actifs_types WHERE id = $1 AND is_active = true',
        [typeId]
      );

      if (typeExists.rows.length === 0) {
        return res.status(404).json({ error: 'Type d\'actif non trouvé' });
      }

      // Vérifier l'unicité du nom pour ce type
      const existingNom = await pool.query(
        'SELECT id FROM actifs_champs_definition WHERE type_actif_id = $1 AND nom = $2',
        [typeId, nom]
      );

      if (existingNom.rows.length > 0) {
        return res.status(400).json({ error: 'Ce nom de champ existe déjà pour ce type' });
      }

      const result = await pool.query(
        `INSERT INTO actifs_champs_definition 
         (type_actif_id, nom, libelle, type_champ, unite, description, ordre, obligatoire, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING *`,
        [
          typeId,
          nom,
          libelle,
          type_champ,
          unite || null,
          description || null,
          ordre || 0,
          obligatoire || false
        ]
      );

      await logAudit({
        userId: req.user.userId,
        action: 'CREATE',
        resourceType: 'actifs_champs_definition',
        resourceId: result.rows[0].id,
        details: { typeId, nom, libelle, type_champ }
      });

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Error creating champ definition:', error);
      res.status(500).json({ error: 'Erreur lors de la création du champ' });
    }
  }
);

/**
 * @route PATCH /api/types-actifs/:typeId/champs/:champId
 * @desc Modifier un champ de définition
 */
router.patch('/:typeId/champs/:champId',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const { typeId, champId } = req.params;
      const { libelle, unite, description, ordre, obligatoire, is_active } = req.body;

      // Vérifier que le champ existe
      const existing = await pool.query(
        'SELECT id FROM actifs_champs_definition WHERE id = $1 AND type_actif_id = $2',
        [champId, typeId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Champ non trouvé' });
      }

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (libelle !== undefined) {
        updates.push(`libelle = $${paramIndex++}`);
        values.push(libelle);
      }
      if (unite !== undefined) {
        updates.push(`unite = $${paramIndex++}`);
        values.push(unite);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (ordre !== undefined) {
        updates.push(`ordre = $${paramIndex++}`);
        values.push(ordre);
      }
      if (obligatoire !== undefined) {
        updates.push(`obligatoire = $${paramIndex++}`);
        values.push(obligatoire);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      updates.push(`updated_at = NOW()`);
      values.push(champId);

      const result = await pool.query(
        `UPDATE actifs_champs_definition 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      await logAudit({
        userId: req.user.userId,
        action: 'UPDATE',
        resourceType: 'actifs_champs_definition',
        resourceId: champId,
        details: req.body
      });

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Error updating champ definition:', error);
      res.status(500).json({ error: 'Erreur lors de la modification du champ' });
    }
  }
);

/**
 * @route DELETE /api/types-actifs/:typeId/champs/:champId
 * @desc Désactiver un champ (soft delete)
 */
router.delete('/:typeId/champs/:champId',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const { typeId, champId } = req.params;

      const result = await pool.query(
        `UPDATE actifs_champs_definition 
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND type_actif_id = $2
         RETURNING *`,
        [champId, typeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Champ non trouvé' });
      }

      await logAudit({
        userId: req.user.userId,
        action: 'DELETE',
        resourceType: 'actifs_champs_definition',
        resourceId: champId
      });

      res.json({
        success: true,
        message: 'Champ désactivé'
      });

    } catch (error) {
      logger.error('Error deleting champ definition:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du champ' });
    }
  }
);

module.exports = router;
