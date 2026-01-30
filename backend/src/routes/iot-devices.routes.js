const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { logAudit } = require('../config/audit');

// ==================== TYPES DE DISPOSITIFS IOT ====================

// Liste des types de dispositifs IoT
router.get('/types',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT dt.*, COUNT(DISTINCT p.id) as parameters_count
      FROM iot_device_types dt
      LEFT JOIN iot_device_parameters p ON dt.id = p.device_type_id AND p.is_active = true
      WHERE dt.is_active = true
      GROUP BY dt.id
      ORDER BY dt.nom
    `);
    res.json({ data: result.rows });
  })
);

// Détail d'un type de dispositif
router.get('/types/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM iot_device_types WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Type de dispositif non trouvé', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Créer un type de dispositif
router.post('/types',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('nom').notEmpty().withMessage('Nom requis'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nom, description, icone } = req.body;

    const result = await pool.query(
      `INSERT INTO iot_device_types (nom, description, icone)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nom, description || null, icone || null]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'iot_device_types',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour un type de dispositif
router.patch('/types/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const { nom, description, icone, is_active } = req.body;

    const result = await pool.query(
      `UPDATE iot_device_types SET
        nom = COALESCE($1, nom),
        description = COALESCE($2, description),
        icone = COALESCE($3, icone),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [nom, description, icone, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Type de dispositif non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'iot_device_types',
      recordId: req.params.id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// ==================== PARAMÈTRES DES TYPES DE DISPOSITIFS ====================

// Liste des paramètres d'un type de dispositif
router.get('/types/:typeId/parameters',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT * FROM iot_device_parameters
       WHERE device_type_id = $1 AND is_active = true
       ORDER BY ordre, libelle`,
      [req.params.typeId]
    );
    res.json({ data: result.rows });
  })
);

// Créer un paramètre pour un type de dispositif
router.post('/types/:typeId/parameters',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('nom').notEmpty().withMessage('Nom requis'),
    body('libelle').notEmpty().withMessage('Libellé requis'),
    body('type_donnee').isIn(['number', 'boolean', 'string', 'date']).withMessage('Type de donnée invalide')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nom, libelle, type_donnee, unite, description, ordre } = req.body;

    const result = await pool.query(
      `INSERT INTO iot_device_parameters 
       (device_type_id, nom, libelle, type_donnee, unite, description, ordre)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.typeId,
        nom,
        libelle,
        type_donnee,
        unite || null,
        description || null,
        ordre || 0
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour un paramètre
router.patch('/parameters/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const { libelle, type_donnee, unite, description, ordre, is_active } = req.body;

    const result = await pool.query(
      `UPDATE iot_device_parameters SET
        libelle = COALESCE($1, libelle),
        type_donnee = COALESCE($2, type_donnee),
        unite = COALESCE($3, unite),
        description = COALESCE($4, description),
        ordre = COALESCE($5, ordre),
        is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [libelle, type_donnee, unite, description, ordre, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Paramètre non trouvé', 404);
    }

    res.json(result.rows[0]);
  })
);

// Supprimer un paramètre
router.delete('/parameters/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM iot_device_parameters WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Paramètre non trouvé', 404);
    }

    res.json({ message: 'Paramètre supprimé' });
  })
);

// ==================== DISPOSITIFS IOT ====================

// Liste des dispositifs IoT
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { actif_id, device_type_id, statut, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT d.*, 
             dt.nom as device_type_nom,
             a.code_interne as actif_code,
             a.description as actif_description,
             b.nom as broker_nom,
             b.is_connected as broker_connected,
             COUNT(DISTINCT pc.id) as parameters_count
      FROM iot_devices d
      LEFT JOIN iot_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN actifs a ON d.actif_id = a.id
      LEFT JOIN mqtt_brokers b ON d.mqtt_broker_id = b.id
      LEFT JOIN iot_device_parameter_configs pc ON d.id = pc.device_id AND pc.is_active = true
      WHERE d.is_active = true
    `;
    const params = [];

    if (actif_id) {
      params.push(actif_id);
      query += ` AND d.actif_id = $${params.length}`;
    }

    if (device_type_id) {
      params.push(device_type_id);
      query += ` AND d.device_type_id = $${params.length}`;
    }

    if (statut) {
      params.push(statut);
      query += ` AND d.statut = $${params.length}`;
    }

    query += ` GROUP BY d.id, dt.nom, a.code_interne, a.description, b.nom, b.is_connected`;
    query += ` ORDER BY d.created_at DESC`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    // Count total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM iot_devices d
      WHERE d.is_active = true
    `;
    const countParams = [];
    
    if (actif_id) {
      countParams.push(actif_id);
      countQuery += ` AND d.actif_id = $${countParams.length}`;
    }
    if (device_type_id) {
      countParams.push(device_type_id);
      countQuery += ` AND d.device_type_id = $${countParams.length}`;
    }
    if (statut) {
      countParams.push(statut);
      countQuery += ` AND d.statut = $${countParams.length}`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  })
);

// Détail d'un dispositif IoT
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT d.*, 
              dt.nom as device_type_nom,
              a.code_interne as actif_code,
              a.description as actif_description,
              b.nom as broker_nom,
              b.is_connected as broker_connected
       FROM iot_devices d
       LEFT JOIN iot_device_types dt ON d.device_type_id = dt.id
       LEFT JOIN actifs a ON d.actif_id = a.id
       LEFT JOIN mqtt_brokers b ON d.mqtt_broker_id = b.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Dispositif non trouvé', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Créer un dispositif IoT
router.post('/',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('nom').notEmpty().withMessage('Nom requis'),
    body('identifiant_unique').notEmpty().withMessage('Identifiant unique requis'),
    body('device_type_id').isUUID().withMessage('Type de dispositif requis'),
    body('actif_id').isUUID().withMessage('Actif requis')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      nom, identifiant_unique, device_type_id, actif_id, mqtt_broker_id,
      mqtt_topic_base, fabricant, modele, version_firmware, date_installation,
      statut, notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO iot_devices 
       (nom, identifiant_unique, device_type_id, actif_id, mqtt_broker_id,
        mqtt_topic_base, fabricant, modele, version_firmware, date_installation,
        statut, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING *`,
      [
        nom,
        identifiant_unique,
        device_type_id,
        actif_id,
        mqtt_broker_id || null,
        mqtt_topic_base || null,
        fabricant || null,
        modele || null,
        version_firmware || null,
        date_installation || null,
        statut || 'actif',
        notes || null,
        req.user.id
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'iot_devices',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour un dispositif IoT
router.patch('/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      nom, device_type_id, actif_id, mqtt_broker_id, mqtt_topic_base,
      fabricant, modele, version_firmware, date_installation, statut,
      notes, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE iot_devices SET
        nom = COALESCE($1, nom),
        device_type_id = COALESCE($2, device_type_id),
        actif_id = COALESCE($3, actif_id),
        mqtt_broker_id = COALESCE($4, mqtt_broker_id),
        mqtt_topic_base = COALESCE($5, mqtt_topic_base),
        fabricant = COALESCE($6, fabricant),
        modele = COALESCE($7, modele),
        version_firmware = COALESCE($8, version_firmware),
        date_installation = COALESCE($9, date_installation),
        statut = COALESCE($10, statut),
        notes = COALESCE($11, notes),
        is_active = COALESCE($12, is_active),
        updated_by = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        nom, device_type_id, actif_id, mqtt_broker_id, mqtt_topic_base,
        fabricant, modele, version_firmware, date_installation, statut,
        notes, is_active, req.user.id, req.params.id
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Dispositif non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'iot_devices',
      recordId: req.params.id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// Supprimer un dispositif IoT
router.delete('/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM iot_devices WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Dispositif non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'iot_devices',
      recordId: req.params.id,
      oldValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Dispositif supprimé' });
  })
);

// ==================== CONFIGURATION DES PARAMÈTRES ====================

// Liste des configurations de paramètres d'un dispositif
router.get('/:deviceId/parameter-configs',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT pc.*, 
              p.nom as parameter_nom,
              p.libelle as parameter_libelle,
              p.type_donnee,
              p.unite,
              acd.libelle as champ_libelle
       FROM iot_device_parameter_configs pc
       LEFT JOIN iot_device_parameters p ON pc.parameter_id = p.id
       LEFT JOIN actifs_champs_definition acd ON pc.champ_definition_id = acd.id
       WHERE pc.device_id = $1
       ORDER BY p.ordre, p.libelle`,
      [req.params.deviceId]
    );
    res.json({ data: result.rows });
  })
);

// Créer ou mettre à jour une configuration de paramètre
router.post('/:deviceId/parameter-configs',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('parameter_id').isUUID().withMessage('Paramètre requis'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      parameter_id, champ_definition_id, champ_standard, mqtt_topic_suffix,
      json_path, transformation, factor, seuil_min, seuil_max, frequence_lecture
    } = req.body;

    const result = await pool.query(
      `INSERT INTO iot_device_parameter_configs 
       (device_id, parameter_id, champ_definition_id, champ_standard, mqtt_topic_suffix,
        json_path, transformation, factor, seuil_min, seuil_max, frequence_lecture)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (device_id, parameter_id)
       DO UPDATE SET
         champ_definition_id = EXCLUDED.champ_definition_id,
         champ_standard = EXCLUDED.champ_standard,
         mqtt_topic_suffix = EXCLUDED.mqtt_topic_suffix,
         json_path = EXCLUDED.json_path,
         transformation = EXCLUDED.transformation,
         factor = EXCLUDED.factor,
         seuil_min = EXCLUDED.seuil_min,
         seuil_max = EXCLUDED.seuil_max,
         frequence_lecture = EXCLUDED.frequence_lecture,
         updated_at = NOW()
       RETURNING *`,
      [
        req.params.deviceId,
        parameter_id,
        champ_definition_id || null,
        champ_standard || null,
        mqtt_topic_suffix || null,
        json_path || '$.value',
        transformation || 'none',
        factor || null,
        seuil_min || null,
        seuil_max || null,
        frequence_lecture || null
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

// Supprimer une configuration de paramètre
router.delete('/:deviceId/parameter-configs/:configId',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM iot_device_parameter_configs WHERE id = $1 AND device_id = $2 RETURNING *',
      [req.params.configId, req.params.deviceId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Configuration non trouvée', 404);
    }

    res.json({ message: 'Configuration supprimée' });
  })
);

// ==================== HISTORIQUE DES VALEURS ====================

// Historique des valeurs d'un dispositif
router.get('/:deviceId/values-history',
  authenticate,
  asyncHandler(async (req, res) => {
    const { parameter_id, start_date, end_date, limit = 100 } = req.query;
    
    let query = `
      SELECT vh.*, 
             p.nom as parameter_nom,
             p.libelle as parameter_libelle,
             p.unite
      FROM iot_device_values_history vh
      LEFT JOIN iot_device_parameters p ON vh.parameter_id = p.id
      WHERE vh.device_id = $1
    `;
    const params = [req.params.deviceId];

    if (parameter_id) {
      params.push(parameter_id);
      query += ` AND vh.parameter_id = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND vh.timestamp >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND vh.timestamp <= $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY vh.timestamp DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  })
);

// Dernières valeurs d'un dispositif
router.get('/:deviceId/latest-values',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT DISTINCT ON (vh.parameter_id)
              vh.*, 
              p.nom as parameter_nom,
              p.libelle as parameter_libelle,
              p.unite,
              p.type_donnee
       FROM iot_device_values_history vh
       LEFT JOIN iot_device_parameters p ON vh.parameter_id = p.id
       WHERE vh.device_id = $1
       ORDER BY vh.parameter_id, vh.timestamp DESC`,
      [req.params.deviceId]
    );
    res.json({ data: result.rows });
  })
);

// ==================== STATISTIQUES ====================

// Statistiques des dispositifs IoT
router.get('/stats/overview',
  authenticate,
  asyncHandler(async (req, res) => {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN statut = 'actif' THEN 1 END) as active_devices,
        COUNT(CASE WHEN statut = 'inactif' THEN 1 END) as inactive_devices,
        COUNT(CASE WHEN statut = 'erreur' THEN 1 END) as error_devices,
        COUNT(CASE WHEN dernier_message > NOW() - INTERVAL '1 hour' THEN 1 END) as online_devices
      FROM iot_devices
      WHERE is_active = true
    `);

    const typeStats = await pool.query(`
      SELECT dt.nom, dt.id, COUNT(d.id) as count
      FROM iot_device_types dt
      LEFT JOIN iot_devices d ON dt.id = d.device_type_id AND d.is_active = true
      WHERE dt.is_active = true
      GROUP BY dt.id, dt.nom
      ORDER BY count DESC
    `);

    res.json({
      overview: stats.rows[0],
      by_type: typeStats.rows
    });
  })
);

module.exports = router;
