const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { logAudit } = require('../config/audit');
const mqttService = require('../config/mqtt');

// ==================== BROKERS MQTT ====================

// Liste des brokers
router.get('/brokers',
  authenticate,
  requirePermission('actifs.view'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT b.*, 
             COUNT(DISTINCT s.id) as subscriptions_count,
             COUNT(DISTINCT m.id) as mappings_count
      FROM mqtt_brokers b
      LEFT JOIN mqtt_subscriptions s ON b.id = s.broker_id AND s.is_active = true
      LEFT JOIN mqtt_actif_mappings m ON s.id = m.subscription_id AND m.is_active = true
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json({ data: result.rows });
  })
);

// Détail d'un broker
router.get('/brokers/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM mqtt_brokers WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Broker non trouvé', 404);
    }
    
    res.json(result.rows[0]);
  })
);

// Créer un broker
router.post('/brokers',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('nom').notEmpty().withMessage('Nom requis'),
    body('host').notEmpty().withMessage('Host requis'),
    body('port').isInt({ min: 1, max: 65535 }).withMessage('Port invalide')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      nom, host, port, protocol, username, password, client_id,
      clean_session, keep_alive, reconnect_period, connect_timeout
    } = req.body;

    const result = await pool.query(
      `INSERT INTO mqtt_brokers 
       (nom, host, port, protocol, username, password, client_id, clean_session,
        keep_alive, reconnect_period, connect_timeout, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING *`,
      [
        nom, host, port || 1883, protocol || 'mqtt',
        username || null, password || null, client_id || null,
        clean_session !== false, keep_alive || 60,
        reconnect_period || 1000, connect_timeout || 30000,
        req.user.id
      ]
    );

    const broker = result.rows[0];

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'mqtt_brokers',
      recordId: broker.id,
      newValues: broker,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(broker);
  })
);

// Mettre à jour un broker
router.patch('/brokers/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      nom, host, port, protocol, username, password, client_id,
      clean_session, keep_alive, reconnect_period, connect_timeout, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE mqtt_brokers SET
        nom = COALESCE($1, nom),
        host = COALESCE($2, host),
        port = COALESCE($3, port),
        protocol = COALESCE($4, protocol),
        username = COALESCE($5, username),
        password = COALESCE($6, password),
        client_id = COALESCE($7, client_id),
        clean_session = COALESCE($8, clean_session),
        keep_alive = COALESCE($9, keep_alive),
        reconnect_period = COALESCE($10, reconnect_period),
        connect_timeout = COALESCE($11, connect_timeout),
        is_active = COALESCE($12, is_active),
        updated_by = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        nom, host, port, protocol, username, password, client_id,
        clean_session, keep_alive, reconnect_period, connect_timeout,
        is_active, req.user.id, req.params.id
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Broker non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'mqtt_brokers',
      recordId: req.params.id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// Supprimer un broker
router.delete('/brokers/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    // Déconnecter d'abord
    await mqttService.disconnectBroker(req.params.id);

    const result = await pool.query(
      'DELETE FROM mqtt_brokers WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Broker non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'mqtt_brokers',
      recordId: req.params.id,
      oldValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Broker supprimé' });
  })
);

// Connecter/déconnecter un broker
router.post('/brokers/:id/connect',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM mqtt_brokers WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Broker non trouvé', 404);
    }

    await mqttService.connectBroker(result.rows[0]);
    res.json({ message: 'Connexion initiée' });
  })
);

router.post('/brokers/:id/disconnect',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    await mqttService.disconnectBroker(req.params.id);
    res.json({ message: 'Déconnexion effectuée' });
  })
);

// ==================== SUBSCRIPTIONS ====================

// Liste des subscriptions d'un broker
router.get('/brokers/:brokerId/subscriptions',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT s.*, COUNT(m.id) as mappings_count
       FROM mqtt_subscriptions s
       LEFT JOIN mqtt_actif_mappings m ON s.id = m.subscription_id AND m.is_active = true
       WHERE s.broker_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [req.params.brokerId]
    );
    res.json({ data: result.rows });
  })
);

// Créer une subscription
router.post('/subscriptions',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('broker_id').isUUID().withMessage('Broker ID requis'),
    body('topic').notEmpty().withMessage('Topic requis'),
    body('qos').optional().isIn([0, 1, 2]).withMessage('QoS invalide')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { broker_id, topic, qos, description } = req.body;

    const result = await pool.query(
      `INSERT INTO mqtt_subscriptions (broker_id, topic, qos, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [broker_id, topic, qos || 0, description || null]
    );

    const subscription = result.rows[0];

    // Recharger le broker pour prendre en compte la nouvelle souscription
    await mqttService.reloadBroker(broker_id);

    res.status(201).json(subscription);
  })
);

// Mettre à jour une subscription
router.patch('/subscriptions/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const { topic, qos, description, is_active } = req.body;

    const result = await pool.query(
      `UPDATE mqtt_subscriptions SET
        topic = COALESCE($1, topic),
        qos = COALESCE($2, qos),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [topic, qos, description, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Subscription non trouvée', 404);
    }

    // Recharger le broker
    const subscription = result.rows[0];
    await mqttService.reloadBroker(subscription.broker_id);

    res.json(subscription);
  })
);

// Supprimer une subscription
router.delete('/subscriptions/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM mqtt_subscriptions WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Subscription non trouvée', 404);
    }

    // Recharger le broker
    await mqttService.reloadBroker(result.rows[0].broker_id);

    res.json({ message: 'Subscription supprimée' });
  })
);

// ==================== MAPPINGS ====================

// Liste des mappings d'une subscription
router.get('/subscriptions/:subscriptionId/mappings',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT m.*, 
              a.code_interne as actif_code,
              acd.libelle as champ_libelle
       FROM mqtt_actif_mappings m
       LEFT JOIN actifs a ON m.actif_id = a.id
       LEFT JOIN actifs_champs_definition acd ON m.champ_definition_id = acd.id
       WHERE m.subscription_id = $1
       ORDER BY m.created_at DESC`,
      [req.params.subscriptionId]
    );
    res.json({ data: result.rows });
  })
);

// Créer un mapping
router.post('/mappings',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('subscription_id').isUUID().withMessage('Subscription ID requis'),
    body('actif_id').isUUID().withMessage('Actif ID requis'),
    body('json_path').notEmpty().withMessage('JSON path requis')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      subscription_id, actif_id, champ_definition_id, champ_standard,
      json_path, transformation, factor, unite_source, unite_cible
    } = req.body;

    const result = await pool.query(
      `INSERT INTO mqtt_actif_mappings 
       (subscription_id, actif_id, champ_definition_id, champ_standard, json_path,
        transformation, factor, unite_source, unite_cible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        subscription_id, actif_id, champ_definition_id || null,
        champ_standard || null, json_path, transformation || 'none',
        factor || null, unite_source || null, unite_cible || null
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

// Mettre à jour un mapping
router.patch('/mappings/:id',
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const {
      json_path, transformation, factor, unite_source, unite_cible, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE mqtt_actif_mappings SET
        json_path = COALESCE($1, json_path),
        transformation = COALESCE($2, transformation),
        factor = COALESCE($3, factor),
        unite_source = COALESCE($4, unite_source),
        unite_cible = COALESCE($5, unite_cible),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [json_path, transformation, factor, unite_source, unite_cible, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Mapping non trouvé', 404);
    }

    res.json(result.rows[0]);
  })
);

// Supprimer un mapping
router.delete('/mappings/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM mqtt_actif_mappings WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Mapping non trouvé', 404);
    }

    res.json({ message: 'Mapping supprimé' });
  })
);

// ==================== STATISTIQUES ====================

// Status général MQTT
router.get('/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM v_mqtt_status');
    res.json({ data: result.rows });
  })
);

// Historique des messages
router.get('/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const { broker_id, limit } = req.query;
    const queryLimit = parseInt(limit) || 100;

    let query = `
      SELECT m.*, b.nom as broker_nom, s.topic as subscription_topic
      FROM mqtt_messages_log m
      LEFT JOIN mqtt_brokers b ON m.broker_id = b.id
      LEFT JOIN mqtt_subscriptions s ON m.subscription_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (broker_id) {
      params.push(broker_id);
      query += ` AND m.broker_id = $${params.length}`;
    }

    params.push(queryLimit);
    query += ` ORDER BY m.received_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  })
);

module.exports = router;
