-- Migration pour intégration MQTT
-- Permet de récupérer des données depuis des brokers MQTT et mettre à jour les actifs

-- 1. Table des brokers MQTT
CREATE TABLE mqtt_brokers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 1883,
    protocol VARCHAR(10) DEFAULT 'mqtt', -- mqtt, mqtts, ws, wss
    username VARCHAR(255),
    password VARCHAR(255),
    client_id VARCHAR(255),
    clean_session BOOLEAN DEFAULT true,
    keep_alive INT DEFAULT 60,
    reconnect_period INT DEFAULT 1000,
    connect_timeout INT DEFAULT 30000,
    is_active BOOLEAN DEFAULT true,
    is_connected BOOLEAN DEFAULT false,
    last_connection TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    updated_by UUID REFERENCES utilisateurs(id)
);

-- 2. Table des souscriptions MQTT (topics)
CREATE TABLE mqtt_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID REFERENCES mqtt_brokers(id) ON DELETE CASCADE,
    topic VARCHAR(500) NOT NULL, -- Ex: sensors/temperature/+, factory/machine/#
    qos INT DEFAULT 0 CHECK (qos IN (0, 1, 2)),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Table de mapping entre topics MQTT et champs d'actifs
CREATE TABLE mqtt_actif_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES mqtt_subscriptions(id) ON DELETE CASCADE,
    actif_id UUID REFERENCES actifs(id) ON DELETE CASCADE,
    champ_definition_id UUID REFERENCES actifs_champs_definition(id), -- Pour champs custom
    champ_standard VARCHAR(100), -- Pour champs standards: numero_serie, description, etc.
    json_path VARCHAR(500) NOT NULL, -- Chemin dans le JSON: $.temperature, $.data.counter, etc.
    transformation VARCHAR(50), -- none, multiply, divide, round, floor, ceil
    factor DECIMAL(15,4), -- Facteur de multiplication/division
    unite_source VARCHAR(50),
    unite_cible VARCHAR(50),
    last_value TEXT,
    last_update TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Table d'historique des messages MQTT reçus
CREATE TABLE mqtt_messages_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID REFERENCES mqtt_brokers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES mqtt_subscriptions(id),
    topic VARCHAR(500) NOT NULL,
    payload TEXT NOT NULL,
    payload_json JSONB, -- Payload parsé en JSON si valide
    qos INT,
    retained BOOLEAN,
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    actifs_updated INT DEFAULT 0,
    received_at TIMESTAMP DEFAULT NOW()
);

-- 5. Index pour performance
CREATE INDEX idx_mqtt_brokers_active ON mqtt_brokers(is_active);
CREATE INDEX idx_mqtt_subscriptions_broker ON mqtt_subscriptions(broker_id);
CREATE INDEX idx_mqtt_subscriptions_active ON mqtt_subscriptions(broker_id, is_active);
CREATE INDEX idx_mqtt_mappings_subscription ON mqtt_actif_mappings(subscription_id);
CREATE INDEX idx_mqtt_mappings_actif ON mqtt_actif_mappings(actif_id);
CREATE INDEX idx_mqtt_messages_log_received ON mqtt_messages_log(received_at);
CREATE INDEX idx_mqtt_messages_log_broker ON mqtt_messages_log(broker_id);
CREATE INDEX idx_mqtt_messages_log_processed ON mqtt_messages_log(processed);

-- 6. Fonction pour nettoyer les vieux logs (>30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_mqtt_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM mqtt_messages_log 
    WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 7. Vues utiles
CREATE VIEW v_mqtt_status AS
SELECT 
    b.id as broker_id,
    b.nom as broker_nom,
    b.host,
    b.port,
    b.is_active,
    b.is_connected,
    b.last_connection,
    COUNT(DISTINCT s.id) as subscriptions_count,
    COUNT(DISTINCT m.id) as mappings_count,
    COUNT(ml.id) FILTER (WHERE ml.received_at > NOW() - INTERVAL '1 hour') as messages_last_hour,
    COUNT(ml.id) FILTER (WHERE ml.received_at > NOW() - INTERVAL '24 hours') as messages_last_day
FROM mqtt_brokers b
LEFT JOIN mqtt_subscriptions s ON b.id = s.broker_id AND s.is_active = true
LEFT JOIN mqtt_actif_mappings m ON s.id = m.subscription_id AND m.is_active = true
LEFT JOIN mqtt_messages_log ml ON b.id = ml.broker_id
GROUP BY b.id, b.nom, b.host, b.port, b.is_active, b.is_connected, b.last_connection;

-- 8. Commentaires
COMMENT ON TABLE mqtt_brokers IS 'Configuration des brokers MQTT (Mosquitto, HiveMQ, etc.)';
COMMENT ON TABLE mqtt_subscriptions IS 'Topics MQTT auxquels souscrire';
COMMENT ON TABLE mqtt_actif_mappings IS 'Mapping entre données MQTT et champs d''actifs';
COMMENT ON TABLE mqtt_messages_log IS 'Historique des messages MQTT reçus';
COMMENT ON COLUMN mqtt_actif_mappings.json_path IS 'Chemin JSONPath pour extraire la valeur (ex: $.temperature, $.data.counter)';
COMMENT ON COLUMN mqtt_actif_mappings.transformation IS 'Transformation à appliquer: none, multiply, divide, round, floor, ceil';
