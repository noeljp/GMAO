-- Migration pour étendre la gestion des dispositifs IoT pour le réseau APRU40
-- Ajoute les tables et champs spécifiques au réseau IoT APRU40 avec gateways et nodes

-- 1. Table des Gateways APRU40
CREATE TABLE apru40_gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_id INTEGER UNIQUE NOT NULL, -- ID unique gateway (1-254)
    gateway_name VARCHAR(255) NOT NULL, -- Nom convivial
    mac_address VARCHAR(17) UNIQUE NOT NULL, -- Adresse MAC
    ip_address VARCHAR(45), -- IPv4 ou IPv6
    mqtt_client_id VARCHAR(255) UNIQUE, -- Client ID MQTT
    mqtt_broker_id UUID REFERENCES mqtt_brokers(id), -- Broker MQTT utilisé
    cert_expiry DATE, -- Expiration certificat TLS
    firmware_version VARCHAR(50), -- Version firmware
    node_count INTEGER DEFAULT 0, -- Nombre de nœuds connectés
    uptime_seconds BIGINT, -- Temps de fonctionnement en secondes
    last_restart TIMESTAMP, -- Dernier redémarrage
    last_seen TIMESTAMP, -- Dernier heartbeat
    status VARCHAR(50) DEFAULT 'online', -- online, offline, maintenance, error
    site_id UUID REFERENCES sites(id), -- Site associé
    location TEXT, -- Emplacement physique
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    updated_by UUID REFERENCES utilisateurs(id)
);

-- 2. Étendre la table iot_devices pour supporter les nœuds APRU40
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS node_id INTEGER; -- ID unique nœud (1-254)
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS gateway_id UUID REFERENCES apru40_gateways(id); -- Gateway parent
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS tamper_count INTEGER DEFAULT 0; -- Nombre de tamper détectés
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS bt_scanner_mac VARCHAR(17); -- MAC scanner BT autorisé
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS bt_pin VARCHAR(10); -- PIN Bluetooth actuel
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS deployed_date DATE; -- Date de déploiement
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS deployed_by VARCHAR(255); -- Opérateur de déploiement
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS location TEXT; -- Emplacement physique
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS seal_number VARCHAR(50); -- Numéro de scellé sécurité
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP; -- Dernier heartbeat

-- Ajouter colonne status si elle n'existe pas déjà (pour compatibilité)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'iot_devices' AND column_name = 'status'
    ) THEN
        ALTER TABLE iot_devices ADD COLUMN status VARCHAR(50);
    END IF;
END $$;

-- Mettre à jour status avec les valeurs existantes de statut
UPDATE iot_devices SET status = statut WHERE status IS NULL;

-- 3. Table des données des capteurs APRU40 (structure spécifique aux capteurs ADS7128, ADS1119, TCA9537)
CREATE TABLE apru40_sensor_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE, -- Nœud associé
    sensor_type VARCHAR(50) NOT NULL, -- ads7128, ads1119_1, ads1119_2, tca9537
    channel_number INTEGER, -- Numéro de canal (0-7 pour ADS7128, 0-3 pour ADS1119, 0-3 pour TCA9537)
    value_numeric DECIMAL(15,4), -- Valeur numérique (tension en mV/V, courant en A, température en °C)
    value_text TEXT, -- Valeur texte pour GPIO (HIGH/LOW)
    unit VARCHAR(20), -- Unité (V, mV, A, °C, etc.)
    timestamp TIMESTAMP DEFAULT NOW(),
    quality VARCHAR(50) DEFAULT 'good', -- good, bad, uncertain
    mqtt_topic VARCHAR(500), -- Topic MQTT source
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Table des alertes APRU40
CREATE TABLE apru40_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL, -- tamper, bt_unauthorized, node_offline, gateway_offline, cert_expiring, battery_low, sensor_anomaly
    priority VARCHAR(20) NOT NULL, -- critique, haute, moyenne, basse
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE, -- Nœud ou NULL si gateway
    gateway_id UUID REFERENCES apru40_gateways(id) ON DELETE CASCADE, -- Gateway ou NULL si node
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'nouveau', -- nouveau, en_cours, resolu, ignore
    assigned_to UUID REFERENCES utilisateurs(id), -- Utilisateur assigné
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES utilisateurs(id),
    resolution_notes TEXT,
    metadata JSONB, -- Données additionnelles (ex: valeur du capteur, MAC BT non autorisé)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Table de configuration des périodes d'acquisition APRU40
CREATE TABLE apru40_device_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
    acquisition_period_ms INTEGER DEFAULT 5000, -- Période d'acquisition capteurs en ms
    espnow_tx_period_ms INTEGER DEFAULT 10000, -- Période de transmission ESP-NOW en ms
    heartbeat_period_ms INTEGER DEFAULT 30000, -- Période de heartbeat en ms
    tamper_auto_erase BOOLEAN DEFAULT true, -- Effacement automatique NVS sur tamper
    config_version INTEGER DEFAULT 1, -- Version de la configuration
    last_updated TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES utilisateurs(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Index pour performance
CREATE INDEX idx_apru40_gateways_status ON apru40_gateways(status);
CREATE INDEX idx_apru40_gateways_site ON apru40_gateways(site_id);
CREATE INDEX idx_apru40_gateways_last_seen ON apru40_gateways(last_seen);
CREATE INDEX idx_iot_devices_gateway ON iot_devices(gateway_id);
CREATE INDEX idx_iot_devices_node_id ON iot_devices(node_id);
CREATE INDEX idx_iot_devices_last_seen ON iot_devices(last_seen);
CREATE INDEX idx_apru40_sensor_data_device ON apru40_sensor_data(device_id);
CREATE INDEX idx_apru40_sensor_data_timestamp ON apru40_sensor_data(timestamp DESC);
CREATE INDEX idx_apru40_sensor_data_sensor_type ON apru40_sensor_data(sensor_type);
CREATE INDEX idx_apru40_alerts_type ON apru40_alerts(alert_type);
CREATE INDEX idx_apru40_alerts_status ON apru40_alerts(status);
CREATE INDEX idx_apru40_alerts_device ON apru40_alerts(device_id);
CREATE INDEX idx_apru40_alerts_gateway ON apru40_alerts(gateway_id);
CREATE INDEX idx_apru40_alerts_priority ON apru40_alerts(priority);
CREATE INDEX idx_apru40_device_config_device ON apru40_device_config(device_id);

-- 7. Vue pour le statut des nœuds APRU40
CREATE OR REPLACE VIEW v_apru40_nodes_status AS
SELECT 
    d.id as node_uuid,
    d.node_id,
    d.nom as node_name,
    d.identifiant_unique as mac_address,
    d.firmware_version,
    d.last_seen,
    d.status,
    d.tamper_count,
    d.bt_scanner_mac,
    d.bt_pin,
    d.deployed_date,
    d.deployed_by,
    d.location,
    d.seal_number,
    d.notes,
    g.gateway_id,
    g.gateway_name,
    g.status as gateway_status,
    a.code_interne as actif_code,
    a.description as actif_description,
    CASE 
        WHEN d.last_seen > NOW() - INTERVAL '60 seconds' THEN 'online'
        WHEN d.last_seen IS NULL THEN 'never_seen'
        ELSE 'offline'
    END as connectivity_status,
    COUNT(DISTINCT al.id) FILTER (WHERE al.status IN ('nouveau', 'en_cours')) as active_alerts_count
FROM iot_devices d
LEFT JOIN apru40_gateways g ON d.gateway_id = g.id
LEFT JOIN actifs a ON d.actif_id = a.id
LEFT JOIN apru40_alerts al ON d.id = al.device_id AND al.is_active = true
WHERE d.is_active = true
GROUP BY d.id, g.gateway_id, g.gateway_name, g.status, a.code_interne, a.description;

-- 8. Vue pour le statut des gateways APRU40
CREATE OR REPLACE VIEW v_apru40_gateways_status AS
SELECT 
    g.id,
    g.gateway_id,
    g.gateway_name,
    g.mac_address,
    g.ip_address,
    g.mqtt_client_id,
    g.cert_expiry,
    g.firmware_version,
    g.node_count,
    g.uptime_seconds,
    g.last_restart,
    g.last_seen,
    g.status,
    g.location,
    s.nom as site_name,
    CASE 
        WHEN g.last_seen > NOW() - INTERVAL '120 seconds' THEN 'online'
        WHEN g.last_seen IS NULL THEN 'never_seen'
        ELSE 'offline'
    END as connectivity_status,
    CASE 
        WHEN g.cert_expiry < NOW() THEN 'expired'
        WHEN g.cert_expiry < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'valid'
    END as cert_status,
    COUNT(DISTINCT d.id) as actual_node_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'online') as online_nodes,
    COUNT(DISTINCT al.id) FILTER (WHERE al.status IN ('nouveau', 'en_cours')) as active_alerts_count
FROM apru40_gateways g
LEFT JOIN sites s ON g.site_id = s.id
LEFT JOIN iot_devices d ON g.id = d.gateway_id AND d.is_active = true
LEFT JOIN apru40_alerts al ON g.id = al.gateway_id AND al.is_active = true
WHERE g.is_active = true
GROUP BY g.id, s.nom;

-- 9. Vue pour les dernières valeurs des capteurs APRU40
CREATE OR REPLACE VIEW v_apru40_latest_sensor_values AS
SELECT DISTINCT ON (device_id, sensor_type, channel_number)
    device_id,
    sensor_type,
    channel_number,
    value_numeric,
    value_text,
    unit,
    timestamp,
    quality
FROM apru40_sensor_data
ORDER BY device_id, sensor_type, channel_number, timestamp DESC;

-- 10. Fonction pour nettoyer les anciennes données de capteurs (>90 jours par défaut)
CREATE OR REPLACE FUNCTION cleanup_old_apru40_sensor_data(retention_days INT DEFAULT 90)
RETURNS void AS $$
BEGIN
    DELETE FROM apru40_sensor_data 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- 11. Fonction pour mettre à jour le compteur de nœuds d'une gateway
CREATE OR REPLACE FUNCTION update_gateway_node_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE apru40_gateways 
        SET node_count = (
            SELECT COUNT(*) 
            FROM iot_devices 
            WHERE gateway_id = NEW.gateway_id AND is_active = true
        ),
        updated_at = NOW()
        WHERE id = NEW.gateway_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE apru40_gateways 
        SET node_count = (
            SELECT COUNT(*) 
            FROM iot_devices 
            WHERE gateway_id = OLD.gateway_id AND is_active = true
        ),
        updated_at = NOW()
        WHERE id = OLD.gateway_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gateway_node_count
    AFTER INSERT OR UPDATE OR DELETE ON iot_devices
    FOR EACH ROW
    WHEN (NEW.gateway_id IS NOT NULL OR OLD.gateway_id IS NOT NULL)
    EXECUTE FUNCTION update_gateway_node_count();

-- 12. Fonction pour mettre à jour last_seen des devices
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE iot_devices 
    SET last_seen = NEW.timestamp,
        updated_at = NOW()
    WHERE id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_device_last_seen
    AFTER INSERT ON apru40_sensor_data
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- 13. Fonction pour créer automatiquement une alerte sur tamper
CREATE OR REPLACE FUNCTION create_tamper_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tamper_count > OLD.tamper_count THEN
        INSERT INTO apru40_alerts (
            alert_type, 
            priority, 
            device_id, 
            title, 
            description,
            metadata
        ) VALUES (
            'tamper',
            'critique',
            NEW.id,
            'Tamper détecté sur ' || NEW.nom,
            'Boîtier ouvert ou NVS effacé détecté. Compteur: ' || NEW.tamper_count,
            jsonb_build_object(
                'tamper_count', NEW.tamper_count,
                'node_id', NEW.node_id,
                'mac_address', NEW.identifiant_unique
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_tamper_alert
    AFTER UPDATE ON iot_devices
    FOR EACH ROW
    WHEN (NEW.tamper_count IS NOT NULL AND OLD.tamper_count IS NOT NULL)
    EXECUTE FUNCTION create_tamper_alert();

-- 14. Insérer un type de dispositif APRU40 Node
INSERT INTO iot_device_types (nom, description, icone) VALUES
('APRU40 Node', 'Nœud capteur APRU40 avec ESP32 et capteurs ADS7128, ADS1119, TCA9537', 'sensors')
ON CONFLICT (nom) DO NOTHING;

-- 15. Insérer des paramètres pour le type APRU40 Node
DO $$
DECLARE
    apru40_type_id UUID;
BEGIN
    SELECT id INTO apru40_type_id FROM iot_device_types WHERE nom = 'APRU40 Node';
    
    IF apru40_type_id IS NOT NULL THEN
        -- Paramètres ADS7128 (8 canaux)
        INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
        (apru40_type_id, 'ads7128_ch0', 'ADS7128 Canal 0', 'number', 'V', 1),
        (apru40_type_id, 'ads7128_ch1', 'ADS7128 Canal 1', 'number', 'V', 2),
        (apru40_type_id, 'ads7128_ch2', 'ADS7128 Canal 2', 'number', 'A', 3),
        (apru40_type_id, 'ads7128_ch3', 'ADS7128 Canal 3', 'number', '°C', 4),
        (apru40_type_id, 'ads7128_ch4', 'ADS7128 Canal 4', 'number', 'V', 5),
        (apru40_type_id, 'ads7128_ch5', 'ADS7128 Canal 5', 'number', 'V', 6),
        (apru40_type_id, 'ads7128_ch6', 'ADS7128 Canal 6', 'number', 'V', 7),
        (apru40_type_id, 'ads7128_ch7', 'ADS7128 Canal 7', 'number', 'V', 8),
        -- Paramètres ADS1119 #1 (4 canaux)
        (apru40_type_id, 'ads1119_1_ch0', 'ADS1119 #1 Canal 0', 'number', 'mV', 9),
        (apru40_type_id, 'ads1119_1_ch1', 'ADS1119 #1 Canal 1', 'number', 'mV', 10),
        (apru40_type_id, 'ads1119_1_ch2', 'ADS1119 #1 Canal 2', 'number', 'mV', 11),
        (apru40_type_id, 'ads1119_1_ch3', 'ADS1119 #1 Canal 3', 'number', 'mV', 12),
        -- Paramètres ADS1119 #2 (4 canaux)
        (apru40_type_id, 'ads1119_2_ch0', 'ADS1119 #2 Canal 0', 'number', 'mV', 13),
        (apru40_type_id, 'ads1119_2_ch1', 'ADS1119 #2 Canal 1', 'number', 'mV', 14),
        (apru40_type_id, 'ads1119_2_ch2', 'ADS1119 #2 Canal 2', 'number', 'mV', 15),
        (apru40_type_id, 'ads1119_2_ch3', 'ADS1119 #2 Canal 3', 'number', 'mV', 16),
        -- Paramètres TCA9537 (4 GPIO)
        (apru40_type_id, 'tca9537_gpio0', 'TCA9537 GPIO 0', 'boolean', '', 17),
        (apru40_type_id, 'tca9537_gpio1', 'TCA9537 GPIO 1', 'boolean', '', 18),
        (apru40_type_id, 'tca9537_gpio2', 'TCA9537 GPIO 2', 'boolean', '', 19),
        (apru40_type_id, 'tca9537_gpio3', 'TCA9537 GPIO 3', 'boolean', '', 20)
        ON CONFLICT (device_type_id, nom) DO NOTHING;
    END IF;
END $$;

-- Migration completed successfully
-- APRU40 IoT extension tables, triggers, views and default data are ready for use
