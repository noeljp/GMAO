const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { logAudit } = require('../config/audit');

// ==================== GATEWAYS APRU40 ====================

// Liste des gateways
router.get('/gateways',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, site_id, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT * FROM v_apru40_gateways_status
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (site_id) {
      params.push(site_id);
      query += ` AND site_id = $${params.length}`;
    }

    query += ` ORDER BY gateway_id`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    // Count total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM apru40_gateways
      WHERE is_active = true
    `;
    const countParams = [];
    
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (site_id) {
      countParams.push(site_id);
      countQuery += ` AND site_id = $${countParams.length}`;
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

// Détail d'une gateway
router.get('/gateways/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM v_apru40_gateways_status WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Gateway non trouvée', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Créer une gateway
router.post('/gateways',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('gateway_id').isInt({ min: 1, max: 254 }).withMessage('Gateway ID doit être entre 1 et 254'),
    body('gateway_name').notEmpty().withMessage('Nom de gateway requis'),
    body('mac_address').notEmpty().withMessage('Adresse MAC requise')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      gateway_id, gateway_name, mac_address, ip_address, mqtt_client_id,
      mqtt_broker_id, cert_expiry, firmware_version, site_id, location, notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO apru40_gateways 
       (gateway_id, gateway_name, mac_address, ip_address, mqtt_client_id,
        mqtt_broker_id, cert_expiry, firmware_version, site_id, location, notes,
        created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING *`,
      [
        gateway_id, gateway_name, mac_address, ip_address || null,
        mqtt_client_id || null, mqtt_broker_id || null, cert_expiry || null,
        firmware_version || null, site_id || null, location || null,
        notes || null, req.user.id
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'apru40_gateways',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour une gateway
router.patch('/gateways/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      gateway_name, mac_address, ip_address, mqtt_client_id, mqtt_broker_id,
      cert_expiry, firmware_version, uptime_seconds, last_restart, last_seen,
      status, site_id, location, notes, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE apru40_gateways SET
        gateway_name = COALESCE($1, gateway_name),
        mac_address = COALESCE($2, mac_address),
        ip_address = COALESCE($3, ip_address),
        mqtt_client_id = COALESCE($4, mqtt_client_id),
        mqtt_broker_id = COALESCE($5, mqtt_broker_id),
        cert_expiry = COALESCE($6, cert_expiry),
        firmware_version = COALESCE($7, firmware_version),
        uptime_seconds = COALESCE($8, uptime_seconds),
        last_restart = COALESCE($9, last_restart),
        last_seen = COALESCE($10, last_seen),
        status = COALESCE($11, status),
        site_id = COALESCE($12, site_id),
        location = COALESCE($13, location),
        notes = COALESCE($14, notes),
        is_active = COALESCE($15, is_active),
        updated_by = $16,
        updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [
        gateway_name, mac_address, ip_address, mqtt_client_id, mqtt_broker_id,
        cert_expiry, firmware_version, uptime_seconds, last_restart, last_seen,
        status, site_id, location, notes, is_active, req.user.id, req.params.id
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Gateway non trouvée', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'apru40_gateways',
      recordId: req.params.id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// Supprimer une gateway
router.delete('/gateways/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM apru40_gateways WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Gateway non trouvée', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'apru40_gateways',
      recordId: req.params.id,
      oldValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Gateway supprimée' });
  })
);

// ==================== NODES APRU40 ====================

// Liste des nœuds APRU40
router.get('/nodes',
  authenticate,
  asyncHandler(async (req, res) => {
    const { gateway_id, status, page = 1, limit = 50, search } = req.query;
    
    let query = `SELECT * FROM v_apru40_nodes_status WHERE 1=1`;
    const params = [];

    if (gateway_id) {
      params.push(gateway_id);
      query += ` AND gateway_id::text = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (node_name ILIKE $${params.length} OR mac_address ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    query += ` ORDER BY node_id`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    // Count total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM iot_devices
      WHERE is_active = true AND node_id IS NOT NULL
    `;
    const countParams = [];
    
    if (gateway_id) {
      countParams.push(gateway_id);
      countQuery += ` AND gateway_id::text = $${countParams.length}`;
    }
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
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

// Détail d'un nœud APRU40
router.get('/nodes/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM v_apru40_nodes_status WHERE node_uuid = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Nœud non trouvé', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Mettre à jour un nœud APRU40 (champs spécifiques)
router.patch('/nodes/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      node_id, gateway_id, tamper_count, bt_scanner_mac, bt_pin,
      deployed_date, deployed_by, location, seal_number, notes,
      last_seen, status
    } = req.body;

    const result = await pool.query(
      `UPDATE iot_devices SET
        node_id = COALESCE($1, node_id),
        gateway_id = COALESCE($2, gateway_id),
        tamper_count = COALESCE($3, tamper_count),
        bt_scanner_mac = COALESCE($4, bt_scanner_mac),
        bt_pin = COALESCE($5, bt_pin),
        deployed_date = COALESCE($6, deployed_date),
        deployed_by = COALESCE($7, deployed_by),
        location = COALESCE($8, location),
        seal_number = COALESCE($9, seal_number),
        notes = COALESCE($10, notes),
        last_seen = COALESCE($11, last_seen),
        status = COALESCE($12, status),
        updated_by = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        node_id, gateway_id, tamper_count, bt_scanner_mac, bt_pin,
        deployed_date, deployed_by, location, seal_number, notes,
        last_seen, status, req.user.id, req.params.id
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Nœud non trouvé', 404);
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

// Régénérer le PIN Bluetooth d'un nœud
router.post('/nodes/:id/regenerate-pin',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    // Générer un PIN aléatoire de 6 chiffres
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await pool.query(
      `UPDATE iot_devices SET
        bt_pin = $1,
        updated_by = $2,
        updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newPin, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Nœud non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'iot_devices',
      recordId: req.params.id,
      newValues: { bt_pin: newPin },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ bt_pin: newPin, message: 'PIN régénéré avec succès' });
  })
);

// ==================== DONNÉES DE CAPTEURS APRU40 ====================

// Dernières valeurs des capteurs d'un nœud
router.get('/nodes/:id/sensor-values',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT * FROM v_apru40_latest_sensor_values WHERE device_id = $1
       ORDER BY sensor_type, channel_number`,
      [req.params.id]
    );
    
    res.json({ data: result.rows });
  })
);

// Historique des valeurs des capteurs d'un nœud
router.get('/nodes/:id/sensor-history',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sensor_type, channel_number, start_date, end_date, limit = 100 } = req.query;
    
    let query = `
      SELECT * FROM apru40_sensor_data
      WHERE device_id = $1
    `;
    const params = [req.params.id];

    if (sensor_type) {
      params.push(sensor_type);
      query += ` AND sensor_type = $${params.length}`;
    }

    if (channel_number !== undefined) {
      params.push(parseInt(channel_number));
      query += ` AND channel_number = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND timestamp >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND timestamp <= $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  })
);

// Ajouter des données de capteur (pour MQTT broker)
router.post('/nodes/:id/sensor-data',
  authenticate,
  [
    body('sensor_type').notEmpty().withMessage('Type de capteur requis'),
    body('channel_number').isInt({ min: 0 }).withMessage('Numéro de canal requis')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      sensor_type, channel_number, value_numeric, value_text, unit, quality, mqtt_topic
    } = req.body;

    const result = await pool.query(
      `INSERT INTO apru40_sensor_data 
       (device_id, sensor_type, channel_number, value_numeric, value_text, unit, quality, mqtt_topic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id, sensor_type, channel_number, value_numeric || null,
        value_text || null, unit || null, quality || 'good', mqtt_topic || null
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

// ==================== CONFIGURATION DES DEVICES APRU40 ====================

// Obtenir la configuration d'un nœud
router.get('/nodes/:id/config',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM apru40_device_config WHERE device_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      // Retourner une configuration par défaut
      return res.json({
        acquisition_period_ms: 5000,
        espnow_tx_period_ms: 10000,
        heartbeat_period_ms: 30000,
        tamper_auto_erase: true,
        config_version: 0
      });
    }
    
    res.json(result.rows[0]);
  })
);

// Mettre à jour la configuration d'un nœud
router.post('/nodes/:id/config',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      acquisition_period_ms, espnow_tx_period_ms, heartbeat_period_ms, tamper_auto_erase
    } = req.body;

    // Désactiver l'ancienne configuration
    await pool.query(
      'UPDATE apru40_device_config SET is_active = false WHERE device_id = $1',
      [req.params.id]
    );

    // Créer la nouvelle configuration
    const result = await pool.query(
      `INSERT INTO apru40_device_config 
       (device_id, acquisition_period_ms, espnow_tx_period_ms, heartbeat_period_ms, 
        tamper_auto_erase, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.params.id,
        acquisition_period_ms || 5000,
        espnow_tx_period_ms || 10000,
        heartbeat_period_ms || 30000,
        tamper_auto_erase !== undefined ? tamper_auto_erase : true,
        req.user.id
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'apru40_device_config',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// ==================== ALERTES APRU40 ====================

// Liste des alertes
router.get('/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    const { alert_type, priority, status, device_id, gateway_id, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT a.*, 
             d.nom as device_name,
             d.node_id,
             g.gateway_name,
             u.prenom || ' ' || u.nom as assigned_to_name
      FROM apru40_alerts a
      LEFT JOIN iot_devices d ON a.device_id = d.id
      LEFT JOIN apru40_gateways g ON a.gateway_id = g.id
      LEFT JOIN utilisateurs u ON a.assigned_to = u.id
      WHERE a.is_active = true
    `;
    const params = [];

    if (alert_type) {
      params.push(alert_type);
      query += ` AND a.alert_type = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND a.priority = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (device_id) {
      params.push(device_id);
      query += ` AND a.device_id = $${params.length}`;
    }

    if (gateway_id) {
      params.push(gateway_id);
      query += ` AND a.gateway_id = $${params.length}`;
    }

    query += ` ORDER BY a.detected_at DESC`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    
    // Count total
    let countQuery = `SELECT COUNT(*) as total FROM apru40_alerts WHERE is_active = true`;
    const countParams = [];
    
    if (alert_type) {
      countParams.push(alert_type);
      countQuery += ` AND alert_type = $${countParams.length}`;
    }
    if (priority) {
      countParams.push(priority);
      countQuery += ` AND priority = $${countParams.length}`;
    }
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (device_id) {
      countParams.push(device_id);
      countQuery += ` AND device_id = $${countParams.length}`;
    }
    if (gateway_id) {
      countParams.push(gateway_id);
      countQuery += ` AND gateway_id = $${countParams.length}`;
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

// Détail d'une alerte
router.get('/alerts/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT a.*, 
              d.nom as device_name,
              d.node_id,
              g.gateway_name,
              u1.prenom || ' ' || u1.nom as assigned_to_name,
              u2.prenom || ' ' || u2.nom as resolved_by_name
       FROM apru40_alerts a
       LEFT JOIN iot_devices d ON a.device_id = d.id
       LEFT JOIN apru40_gateways g ON a.gateway_id = g.id
       LEFT JOIN utilisateurs u1 ON a.assigned_to = u1.id
       LEFT JOIN utilisateurs u2 ON a.resolved_by = u2.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Alerte non trouvée', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Créer une alerte
router.post('/alerts',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('alert_type').notEmpty().withMessage('Type d\'alerte requis'),
    body('priority').notEmpty().withMessage('Priorité requise'),
    body('title').notEmpty().withMessage('Titre requis')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      alert_type, priority, device_id, gateway_id, title, description, metadata
    } = req.body;

    const result = await pool.query(
      `INSERT INTO apru40_alerts 
       (alert_type, priority, device_id, gateway_id, title, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        alert_type, priority, device_id || null, gateway_id || null,
        title, description || null, metadata || null
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'apru40_alerts',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour une alerte (assigner, changer statut, etc.)
router.patch('/alerts/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const { status, assigned_to, resolution_notes } = req.body;

    let resolved_at = null;
    let resolved_by = null;

    if (status === 'resolu') {
      resolved_at = new Date();
      resolved_by = req.user.id;
    }

    const result = await pool.query(
      `UPDATE apru40_alerts SET
        status = COALESCE($1, status),
        assigned_to = COALESCE($2, assigned_to),
        resolution_notes = COALESCE($3, resolution_notes),
        resolved_at = COALESCE($4, resolved_at),
        resolved_by = COALESCE($5, resolved_by),
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [status, assigned_to, resolution_notes, resolved_at, resolved_by, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Alerte non trouvée', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'apru40_alerts',
      recordId: req.params.id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// ==================== STATISTIQUES ====================

// Statistiques du réseau APRU40
router.get('/stats/overview',
  authenticate,
  asyncHandler(async (req, res) => {
    // Stats des gateways
    const gatewayStats = await pool.query(`
      SELECT 
        COUNT(*) as total_gateways,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_gateways,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_gateways,
        COUNT(CASE WHEN cert_expiry < NOW() + INTERVAL '30 days' THEN 1 END) as cert_expiring_soon
      FROM apru40_gateways
      WHERE is_active = true
    `);

    // Stats des nœuds
    const nodeStats = await pool.query(`
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_nodes,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_nodes,
        COUNT(CASE WHEN status = 'compromised' THEN 1 END) as compromised_nodes,
        COUNT(CASE WHEN last_seen > NOW() - INTERVAL '60 seconds' THEN 1 END) as recently_seen_nodes,
        SUM(tamper_count) as total_tampers
      FROM iot_devices
      WHERE is_active = true AND node_id IS NOT NULL
    `);

    // Stats des alertes
    const alertStats = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'nouveau' THEN 1 END) as new_alerts,
        COUNT(CASE WHEN status = 'en_cours' THEN 1 END) as in_progress_alerts,
        COUNT(CASE WHEN status = 'resolu' THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN priority = 'critique' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN priority = 'haute' THEN 1 END) as high_alerts
      FROM apru40_alerts
      WHERE is_active = true
    `);

    // Alertes par type
    const alertsByType = await pool.query(`
      SELECT alert_type, COUNT(*) as count
      FROM apru40_alerts
      WHERE is_active = true AND status IN ('nouveau', 'en_cours')
      GROUP BY alert_type
      ORDER BY count DESC
    `);

    res.json({
      gateways: gatewayStats.rows[0],
      nodes: nodeStats.rows[0],
      alerts: alertStats.rows[0],
      alerts_by_type: alertsByType.rows
    });
  })
);

// Statistiques de connectivité dans le temps (pour graphiques)
router.get('/stats/connectivity-history',
  authenticate,
  asyncHandler(async (req, res) => {
    const { hours = 24 } = req.query;
    
    // Cette requête nécessiterait une table d'historique ou des snapshots
    // Pour l'instant, on retourne des données simulées
    // TODO: Implémenter un système de snapshots périodiques
    
    res.json({
      message: 'Historique de connectivité - À implémenter avec système de snapshots',
      hours: parseInt(hours)
    });
  })
);

module.exports = router;
