const mqtt = require('mqtt');
const { JSONPath } = require('jsonpath-plus');
const pool = require('./database');
const logger = require('./logger');

class MQTTService {
  constructor() {
    this.clients = new Map(); // Map<brokerId, mqttClient>
    this.subscriptions = new Map(); // Map<brokerId, Set<topic>>
  }

  /**
   * Démarrer tous les brokers actifs
   */
  async startAll() {
    try {
      const result = await pool.query(
        'SELECT * FROM mqtt_brokers WHERE is_active = true'
      );
      
      for (const broker of result.rows) {
        await this.connectBroker(broker);
      }
      
      logger.info(`MQTT Service started with ${result.rows.length} broker(s)`);
    } catch (error) {
      logger.error('Error starting MQTT service:', error);
    }
  }

  /**
   * Connecter à un broker MQTT
   */
  async connectBroker(broker) {
    try {
      // Déconnecter si déjà connecté
      if (this.clients.has(broker.id)) {
        await this.disconnectBroker(broker.id);
      }

      const options = {
        clientId: broker.client_id || `gmao_${broker.id.substring(0, 8)}`,
        clean: broker.clean_session !== false,
        keepalive: broker.keep_alive || 60,
        reconnectPeriod: broker.reconnect_period || 1000,
        connectTimeout: broker.connect_timeout || 30000,
      };

      if (broker.username && broker.password) {
        options.username = broker.username;
        options.password = broker.password;
      }

      const url = `${broker.protocol}://${broker.host}:${broker.port}`;
      logger.info(`Connecting to MQTT broker: ${broker.nom} (${url})`);

      const client = mqtt.connect(url, options);

      // Event: Connected
      client.on('connect', async () => {
        logger.info(`MQTT broker connected: ${broker.nom}`);
        
        await pool.query(
          `UPDATE mqtt_brokers 
           SET is_connected = true, last_connection = NOW(), last_error = NULL 
           WHERE id = $1`,
          [broker.id]
        );

        // Souscrire aux topics
        await this.subscribeToTopics(broker.id, client);
      });

      // Event: Message reçu
      client.on('message', async (topic, message, packet) => {
        await this.handleMessage(broker.id, topic, message, packet);
      });

      // Event: Error
      client.on('error', async (error) => {
        logger.error(`MQTT broker error (${broker.nom}):`, error);
        
        await pool.query(
          `UPDATE mqtt_brokers 
           SET last_error = $1 
           WHERE id = $2`,
          [error.message, broker.id]
        );
      });

      // Event: Disconnected
      client.on('close', async () => {
        logger.warn(`MQTT broker disconnected: ${broker.nom}`);
        
        await pool.query(
          `UPDATE mqtt_brokers 
           SET is_connected = false 
           WHERE id = $1`,
          [broker.id]
        );
      });

      this.clients.set(broker.id, client);
      this.subscriptions.set(broker.id, new Set());

    } catch (error) {
      logger.error(`Error connecting to broker ${broker.nom}:`, error);
      
      await pool.query(
        `UPDATE mqtt_brokers 
         SET is_connected = false, last_error = $1 
         WHERE id = $2`,
        [error.message, broker.id]
      );
    }
  }

  /**
   * Souscrire aux topics d'un broker
   */
  async subscribeToTopics(brokerId, client) {
    try {
      const result = await pool.query(
        `SELECT * FROM mqtt_subscriptions 
         WHERE broker_id = $1 AND is_active = true`,
        [brokerId]
      );

      const subscriptionSet = this.subscriptions.get(brokerId);

      for (const sub of result.rows) {
        client.subscribe(sub.topic, { qos: sub.qos }, (err) => {
          if (err) {
            logger.error(`Error subscribing to ${sub.topic}:`, err);
          } else {
            logger.info(`Subscribed to topic: ${sub.topic} (QoS ${sub.qos})`);
            subscriptionSet.add(sub.topic);
          }
        });
      }
    } catch (error) {
      logger.error('Error subscribing to topics:', error);
    }
  }

  /**
   * Gérer un message MQTT reçu
   */
  async handleMessage(brokerId, topic, message, packet) {
    const startTime = Date.now();
    let payloadJson = null;
    let processed = false;
    let processingError = null;
    let actifsUpdated = 0;

    try {
      const payload = message.toString();
      logger.debug(`MQTT message received - Topic: ${topic}, Payload: ${payload}`);

      // Parser le JSON
      try {
        payloadJson = JSON.parse(payload);
      } catch (e) {
        processingError = `Invalid JSON: ${e.message}`;
        logger.warn(processingError);
      }

      // Trouver la souscription correspondante
      const subResult = await pool.query(
        `SELECT * FROM mqtt_subscriptions 
         WHERE broker_id = $1 AND is_active = true`,
        [brokerId]
      );

      let matchingSubscription = null;
      for (const sub of subResult.rows) {
        if (this.topicMatches(sub.topic, topic)) {
          matchingSubscription = sub;
          break;
        }
      }

      if (!matchingSubscription) {
        processingError = 'No matching subscription found';
        logger.debug(processingError);
      } else if (payloadJson) {
        // Traiter les mappings
        actifsUpdated = await this.processMappings(
          matchingSubscription.id,
          payloadJson,
          topic
        );
        processed = true;
      }

      // Enregistrer dans les logs
      await pool.query(
        `INSERT INTO mqtt_messages_log 
         (broker_id, subscription_id, topic, payload, payload_json, qos, retained, 
          processed, processing_error, actifs_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          brokerId,
          matchingSubscription?.id || null,
          topic,
          payload,
          payloadJson,
          packet.qos,
          packet.retain,
          processed,
          processingError,
          actifsUpdated
        ]
      );

      const duration = Date.now() - startTime;
      logger.info(`MQTT message processed in ${duration}ms - ${actifsUpdated} actif(s) updated`);

    } catch (error) {
      logger.error('Error handling MQTT message:', error);
      
      try {
        await pool.query(
          `INSERT INTO mqtt_messages_log 
           (broker_id, topic, payload, processed, processing_error)
           VALUES ($1, $2, $3, false, $4)`,
          [brokerId, topic, message.toString(), error.message]
        );
      } catch (logError) {
        logger.error('Error logging MQTT message:', logError);
      }
    }
  }

  /**
   * Traiter les mappings pour un message
   */
  async processMappings(subscriptionId, payloadJson, topic) {
    try {
      const mappingsResult = await pool.query(
        `SELECT m.*, a.type_id, acd.type_champ
         FROM mqtt_actif_mappings m
         LEFT JOIN actifs a ON m.actif_id = a.id
         LEFT JOIN actifs_champs_definition acd ON m.champ_definition_id = acd.id
         WHERE m.subscription_id = $1 AND m.is_active = true`,
        [subscriptionId]
      );

      let updated = 0;

      for (const mapping of mappingsResult.rows) {
        try {
          // Extraire la valeur avec JSONPath
          const values = JSONPath({ path: mapping.json_path, json: payloadJson });
          
          if (!values || values.length === 0) {
            logger.debug(`No value found for path ${mapping.json_path} in topic ${topic}`);
            continue;
          }

          let value = values[0];

          // Appliquer transformation
          value = this.applyTransformation(value, mapping.transformation, mapping.factor);

          // Mettre à jour l'actif
          const success = await this.updateActifField(
            mapping.actif_id,
            mapping.champ_definition_id,
            mapping.champ_standard,
            value,
            mapping.champ_definition_id ? mappingsResult.rows[0].type_champ : 'text'
          );

          if (success) {
            updated++;
            
            // Mettre à jour le mapping
            await pool.query(
              `UPDATE mqtt_actif_mappings 
               SET last_value = $1, last_update = NOW() 
               WHERE id = $2`,
              [String(value), mapping.id]
            );
          }

        } catch (error) {
          logger.error(`Error processing mapping ${mapping.id}:`, error);
        }
      }

      // Traiter aussi les dispositifs IoT
      await this.processIoTDevices(topic, payloadJson);

      return updated;
    } catch (error) {
      logger.error('Error processing mappings:', error);
      return 0;
    }
  }

  /**
   * Traiter les dispositifs IoT pour un message MQTT
   */
  async processIoTDevices(topic, payloadJson) {
    try {
      // Trouver les dispositifs IoT qui correspondent au topic
      const devicesResult = await pool.query(
        `SELECT d.id, d.mqtt_topic_base, d.actif_id
         FROM iot_devices d
         WHERE d.is_active = true 
         AND d.mqtt_topic_base IS NOT NULL
         AND $1 LIKE (d.mqtt_topic_base || '%')`,
        [topic]
      );

      for (const device of devicesResult.rows) {
        // Récupérer les configurations de paramètres actives pour ce dispositif
        const configsResult = await pool.query(
          `SELECT pc.*, p.type_donnee
           FROM iot_device_parameter_configs pc
           LEFT JOIN iot_device_parameters p ON pc.parameter_id = p.id
           WHERE pc.device_id = $1 AND pc.is_active = true`,
          [device.id]
        );

        for (const config of configsResult.rows) {
          try {
            // Vérifier si le topic correspond (avec le suffixe)
            const fullTopic = device.mqtt_topic_base + (config.mqtt_topic_suffix || '');
            if (topic !== fullTopic) {
              continue;
            }

            // Extraire la valeur avec JSONPath
            const values = JSONPath({ path: config.json_path, json: payloadJson });
            
            if (!values || values.length === 0) {
              logger.debug(`No value found for IoT device ${device.id}, path ${config.json_path}`);
              continue;
            }

            let value = values[0];

            // Appliquer transformation
            value = this.applyTransformation(value, config.transformation, config.factor);

            // Stocker dans l'historique
            const columnName = this.getValueColumnForType(config.type_donnee);
            await pool.query(
              `INSERT INTO iot_device_values_history 
               (device_id, parameter_id, ${columnName}, mqtt_topic, timestamp)
               VALUES ($1, $2, $3, $4, NOW())`,
              [device.id, config.parameter_id, value, topic]
            );

            // Mettre à jour l'actif si un champ est configuré
            if (config.champ_definition_id || config.champ_standard) {
              await this.updateActifField(
                device.actif_id,
                config.champ_definition_id,
                config.champ_standard,
                value,
                config.type_donnee
              );
            }

            // Vérifier les seuils
            if (config.type_donnee === 'number' && !isNaN(value)) {
              const numValue = parseFloat(value);
              if ((config.seuil_min && numValue < config.seuil_min) ||
                  (config.seuil_max && numValue > config.seuil_max)) {
                logger.warn(
                  `IoT threshold exceeded for device ${device.id}, parameter ${config.parameter_id}: ${numValue}`
                );
                // Les alertes seront créées par la fonction verifierSeuils si l'actif est mis à jour
              }
            }

            logger.debug(`IoT value processed for device ${device.id}, parameter ${config.parameter_id}: ${value}`);

          } catch (error) {
            logger.error(`Error processing IoT config ${config.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error processing IoT devices:', error);
    }
  }

  /**
   * Obtenir le nom de la colonne pour un type de donnée
   */
  getValueColumnForType(typeData) {
    switch (typeData) {
      case 'number':
        return 'valeur_number';
      case 'boolean':
        return 'valeur_boolean';
      case 'date':
        return 'valeur_date';
      default:
        return 'valeur_text';
    }
  }

  /**
   * Mettre à jour un champ d'actif et vérifier les seuils
   */
  async updateActifField(actifId, champDefinitionId, champStandard, value, typeChamp) {
    try {
      if (champDefinitionId) {
        // Champ personnalisé
        const columnMap = {
          text: 'valeur_text',
          textarea: 'valeur_text',
          number: 'valeur_number',
          date: 'valeur_date',
          boolean: 'valeur_boolean',
          select: 'valeur_text'
        };

        const column = columnMap[typeChamp] || 'valeur_text';
        
        await pool.query(
          `INSERT INTO actifs_champs_valeurs (actif_id, champ_definition_id, ${column})
           VALUES ($1, $2, $3)
           ON CONFLICT (actif_id, champ_definition_id)
           DO UPDATE SET ${column} = EXCLUDED.${column}, updated_at = NOW()`,
          [actifId, champDefinitionId, value]
        );

      } else if (champStandard) {
        // Champ standard
        const allowedFields = ['numero_serie', 'description'];
        
        if (allowedFields.includes(champStandard)) {
          await pool.query(
            `UPDATE actifs SET ${champStandard} = $1, updated_at = NOW() WHERE id = $2`,
            [value, actifId]
          );
        }
      }

      // Vérifier les seuils d'alerte (seulement pour les valeurs numériques)
      if (typeChamp === 'number' && !isNaN(value)) {
        await this.verifierSeuils(actifId, champDefinitionId, champStandard, parseFloat(value));
      }

      return true;
    } catch (error) {
      logger.error('Error updating actif field:', error);
      return false;
    }
  }

  /**
   * Appliquer transformation sur une valeur
   */
  applyTransformation(value, transformation, factor) {
    if (!transformation || transformation === 'none') {
      return value;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return value;
    }

    switch (transformation) {
      case 'multiply':
        return numValue * (factor || 1);
      case 'divide':
        return numValue / (factor || 1);
      case 'round':
        return Math.round(numValue);
      case 'floor':
        return Math.floor(numValue);
      case 'ceil':
        return Math.ceil(numValue);
      default:
        return value;
    }
  }

  /**
   * Vérifier si un topic correspond à un pattern MQTT
   */
  topicMatches(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts[patternParts.length - 1] === '#') {
      // Wildcard multilevel
      const basePattern = patternParts.slice(0, -1);
      const baseTopic = topicParts.slice(0, basePattern.length);
      return basePattern.every((part, i) => part === '+' || part === baseTopic[i]);
    }

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    return patternParts.every((part, i) => {
      return part === '+' || part === topicParts[i];
    });
  }

  /**
   * Déconnecter un broker
   */
  async disconnectBroker(brokerId) {
    const client = this.clients.get(brokerId);
    if (client) {
      client.end(true);
      this.clients.delete(brokerId);
      this.subscriptions.delete(brokerId);
      
      await pool.query(
        'UPDATE mqtt_brokers SET is_connected = false WHERE id = $1',
        [brokerId]
      );
      
      logger.info(`Broker ${brokerId} disconnected`);
    }
  }

  /**
   * Recharger un broker (reconnexion)
   */
  async reloadBroker(brokerId) {
    const result = await pool.query(
      'SELECT * FROM mqtt_brokers WHERE id = $1',
      [brokerId]
    );

    if (result.rows.length > 0) {
      await this.connectBroker(result.rows[0]);
    }
  }

  /**
   * Vérifier les seuils d'alerte et créer les alertes si nécessaire
   */
  async verifierSeuils(actifId, champDefinitionId, champStandard, nouvelleValeur) {
    try {
      // Appeler la fonction PostgreSQL de vérification
      const result = await pool.query(
        `SELECT * FROM verifier_seuils_alerte($1, $2, $3, $4)`,
        [actifId, champDefinitionId, champStandard, nouvelleValeur]
      );

      for (const seuil of result.rows) {
        if (seuil.seuil_depasse) {
          logger.warn(`Seuil dépassé pour actif ${actifId}: ${seuil.message_alerte}`);

          // Créer l'alerte dans l'historique
          const alerteResult = await pool.query(
            `INSERT INTO alertes_historique 
             (seuil_alerte_id, actif_id, valeur_declenchement, valeur_seuil, 
              niveau_alerte, message, notification_envoyee)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING id`,
            [
              seuil.seuil_id,
              actifId,
              nouvelleValeur,
              seuil.template_id ? null : nouvelleValeur, // valeur_seuil pour info
              seuil.niveau_alerte,
              seuil.message_alerte
            ]
          );

          const alerteId = alerteResult.rows[0].id;

          // Créer un ordre de travail si nécessaire
          if (
            seuil.action_automatique === 'ordre_travail' ||
            seuil.action_automatique === 'notification_et_ordre'
          ) {
            if (seuil.template_id) {
              const ordreId = await pool.query(
                `SELECT creer_ordre_travail_preventif($1, $2, $3) as ordre_id`,
                [seuil.template_id, actifId, alerteId]
              );

              if (ordreId.rows[0]?.ordre_id) {
                logger.info(
                  `Ordre de travail préventif créé: ${ordreId.rows[0].ordre_id} pour alerte ${alerteId}`
                );
              }
            }
          }

          // TODO: Envoyer une notification si nécessaire
          if (
            seuil.action_automatique === 'notification' ||
            seuil.action_automatique === 'notification_et_ordre'
          ) {
            // Marquer comme notification envoyée
            await pool.query(
              `UPDATE alertes_historique SET notification_envoyee = true WHERE id = $1`,
              [alerteId]
            );
          }
        }
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des seuils:', error);
    }
  }

  /**
   * Arrêter tous les brokers
   */
  async stopAll() {
    for (const [brokerId, client] of this.clients.entries()) {
      client.end(true);
      logger.info(`Stopped MQTT broker: ${brokerId}`);
    }
    
    this.clients.clear();
    this.subscriptions.clear();
    
    await pool.query('UPDATE mqtt_brokers SET is_connected = false');
    
    logger.info('MQTT Service stopped');
  }

  /**
   * Publier un message (optionnel)
   */
  async publish(brokerId, topic, message, options = {}) {
    const client = this.clients.get(brokerId);
    if (!client || !client.connected) {
      throw new Error('Broker not connected');
    }

    return new Promise((resolve, reject) => {
      client.publish(topic, message, options, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Singleton
const mqttService = new MQTTService();

module.exports = mqttService;
