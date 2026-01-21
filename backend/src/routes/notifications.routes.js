const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const logger = require('../config/logger');

// Obtenir les notifications de l'utilisateur connecté
router.get('/', 
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const lue = req.query.lue; // undefined, 'true', ou 'false'

    let whereCondition = 'WHERE utilisateur_id = $1';
    const queryParams = [req.user.id];
    let paramIndex = 2;

    if (lue === 'true') {
      whereCondition += ` AND lue = true`;
    } else if (lue === 'false') {
      whereCondition += ` AND lue = false`;
    }

    const result = await pool.query(
      `SELECT * FROM notifications
       ${whereCondition}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications ${whereCondition}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// Obtenir le nombre de notifications non lues
router.get('/unread-count', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE utilisateur_id = $1 AND lue = false`,
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  })
);

// Obtenir une notification spécifique
router.get('/:id', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE id = $1 AND utilisateur_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Notification non trouvée', 404);
    }

    res.json(result.rows[0]);
  })
);

// Marquer une notification comme lue
router.patch('/:id/read', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE notifications
       SET lue = true, date_lecture = NOW()
       WHERE id = $1 AND utilisateur_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Notification non trouvée', 404);
    }

    res.json(result.rows[0]);
  })
);

// Marquer toutes les notifications comme lues
router.patch('/mark-all-read', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE notifications
       SET lue = true, date_lecture = NOW()
       WHERE utilisateur_id = $1 AND lue = false
       RETURNING id`,
      [req.user.id]
    );

    res.json({ 
      message: 'Notifications marquées comme lues',
      count: result.rows.length 
    });
  })
);

// Supprimer une notification
router.delete('/:id', 
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND utilisateur_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Notification non trouvée', 404);
    }

    res.json({ message: 'Notification supprimée' });
  })
);

// Créer une notification (admin/système uniquement)
router.post('/', 
  authenticate,
  [
    body('utilisateur_id').isUUID().withMessage('ID utilisateur invalide'),
    body('type').isIn(['info', 'avertissement', 'erreur', 'succes']).withMessage('Type invalide'),
    body('titre').notEmpty().withMessage('Le titre est requis'),
    body('message').notEmpty().withMessage('Le message est requis'),
    body('entite_type').optional(),
    body('entite_id').optional().isUUID()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { utilisateur_id, type, titre, message, entite_type, entite_id } = req.body;

    const result = await pool.query(
      `INSERT INTO notifications 
       (utilisateur_id, type, titre, message, entite_type, entite_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [utilisateur_id, type, titre, message, entite_type, entite_id]
    );

    logger.info('Notification créée', { 
      notificationId: result.rows[0].id,
      userId: utilisateur_id,
      type 
    });

    res.status(201).json(result.rows[0]);
  })
);

/**
 * Fonction utilitaire pour créer des notifications
 * À utiliser dans d'autres routes/modules
 */
async function createNotification({ utilisateurId, type, titre, message, entiteType, entiteId }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications 
       (utilisateur_id, type, titre, message, entite_type, entite_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [utilisateurId, type, titre, message, entiteType, entiteId]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Erreur lors de la création de notification', { error, utilisateurId });
    throw error;
  }
}

/**
 * Notifier lors d'un changement de statut d'OT
 */
async function notifyOTStatusChange(otId, nouveauStatut, userId) {
  try {
    // Récupérer les infos de l'OT et les personnes à notifier
    const otResult = await pool.query(
      `SELECT ot.*, u.id as technicien_id, c.id as createur_id
       FROM ordres_travail ot
       LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
       LEFT JOIN utilisateurs c ON ot.created_by = c.id
       WHERE ot.id = $1`,
      [otId]
    );

    if (otResult.rows.length === 0) return;

    const ot = otResult.rows[0];
    const usersToNotify = new Set([ot.technicien_id, ot.createur_id].filter(Boolean));
    usersToNotify.delete(userId); // Ne pas notifier l'auteur du changement

    const titre = `OT ${ot.numero} - Changement de statut`;
    const message = `L'ordre de travail "${ot.titre}" est maintenant "${nouveauStatut}"`;

    for (const utilisateurId of usersToNotify) {
      await createNotification({
        utilisateurId,
        type: 'info',
        titre,
        message,
        entiteType: 'ordre_travail',
        entiteId: otId
      });
    }
  } catch (error) {
    logger.error('Erreur lors de la notification OT', { error, otId });
  }
}

/**
 * Notifier lors d'une nouvelle affectation
 */
async function notifyAssignment(otId, technicienId, userId) {
  try {
    const otResult = await pool.query(
      'SELECT numero, titre FROM ordres_travail WHERE id = $1',
      [otId]
    );

    if (otResult.rows.length === 0) return;

    const ot = otResult.rows[0];

    await createNotification({
      utilisateurId: technicienId,
      type: 'info',
      titre: 'Nouvelle affectation',
      message: `Vous avez été affecté à l'OT ${ot.numero}: "${ot.titre}"`,
      entiteType: 'ordre_travail',
      entiteId: otId
    });
  } catch (error) {
    logger.error('Erreur lors de la notification d\'affectation', { error, otId });
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyOTStatusChange = notifyOTStatusChange;
module.exports.notifyAssignment = notifyAssignment;
