-- Migration pour la gestion des dispositifs IoT
-- Permet de gérer les dispositifs IoT associés aux machines (actifs)

-- 1. Table des types de dispositifs IoT
CREATE TABLE iot_device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icone VARCHAR(50), -- Nom de l'icône pour l'affichage
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Table des paramètres disponibles pour chaque type de dispositif IoT
CREATE TABLE iot_device_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_type_id UUID REFERENCES iot_device_types(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL, -- Ex: temperature, humidity, pressure, door_status, power_consumption
    libelle VARCHAR(255) NOT NULL, -- Ex: Température, Humidité, Pression, État de la porte
    type_donnee VARCHAR(50) NOT NULL, -- number, boolean, string, date
    unite VARCHAR(50), -- °C, %, Pa, kWh, etc.
    description TEXT,
    ordre INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_type_id, nom)
);

-- 3. Table des dispositifs IoT
CREATE TABLE iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_type_id UUID REFERENCES iot_device_types(id),
    actif_id UUID REFERENCES actifs(id) ON DELETE CASCADE, -- Machine associée
    nom VARCHAR(255) NOT NULL,
    identifiant_unique VARCHAR(255) UNIQUE NOT NULL, -- ID unique du dispositif (ex: serial number, MAC address)
    mqtt_broker_id UUID REFERENCES mqtt_brokers(id), -- Broker MQTT utilisé
    mqtt_topic_base VARCHAR(500), -- Topic MQTT de base (ex: factory/machine/M001)
    fabricant VARCHAR(255),
    modele VARCHAR(255),
    version_firmware VARCHAR(50),
    date_installation DATE,
    date_derniere_communication TIMESTAMP,
    statut VARCHAR(50) DEFAULT 'actif', -- actif, inactif, maintenance, erreur
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    updated_by UUID REFERENCES utilisateurs(id)
);

-- 4. Table de configuration des paramètres d'un dispositif IoT spécifique
CREATE TABLE iot_device_parameter_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
    parameter_id UUID REFERENCES iot_device_parameters(id),
    champ_definition_id UUID REFERENCES actifs_champs_definition(id), -- Champ personnalisé de l'actif à mettre à jour
    champ_standard VARCHAR(100), -- Ou champ standard de l'actif
    mqtt_topic_suffix VARCHAR(200), -- Suffixe du topic MQTT (ex: /temperature, /status)
    json_path VARCHAR(500), -- Chemin dans le payload JSON (ex: $.value, $.data.temperature)
    transformation VARCHAR(50) DEFAULT 'none', -- none, multiply, divide, round, floor, ceil
    factor DECIMAL(15,4), -- Facteur de transformation
    seuil_min DECIMAL(15,4), -- Seuil minimum pour alerte
    seuil_max DECIMAL(15,4), -- Seuil maximum pour alerte
    frequence_lecture INT, -- Fréquence de lecture en secondes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, parameter_id)
);

-- 5. Table d'historique des valeurs des paramètres IoT
CREATE TABLE iot_device_values_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
    parameter_id UUID REFERENCES iot_device_parameters(id),
    valeur_text TEXT,
    valeur_number DECIMAL(15,4),
    valeur_boolean BOOLEAN,
    valeur_date TIMESTAMP,
    mqtt_topic VARCHAR(500),
    timestamp TIMESTAMP DEFAULT NOW(),
    qualite VARCHAR(50) DEFAULT 'good' -- good, bad, uncertain
);

-- 6. Index pour performance
CREATE INDEX idx_iot_device_types_active ON iot_device_types(is_active);
CREATE INDEX idx_iot_devices_actif ON iot_devices(actif_id);
CREATE INDEX idx_iot_devices_type ON iot_devices(device_type_id);
CREATE INDEX idx_iot_devices_broker ON iot_devices(mqtt_broker_id);
CREATE INDEX idx_iot_devices_statut ON iot_devices(statut);
CREATE INDEX idx_iot_device_parameters_type ON iot_device_parameters(device_type_id);
CREATE INDEX idx_iot_device_parameter_configs_device ON iot_device_parameter_configs(device_id);
CREATE INDEX idx_iot_device_values_history_device ON iot_device_values_history(device_id);
CREATE INDEX idx_iot_device_values_history_timestamp ON iot_device_values_history(timestamp);

-- 7. Fonction pour nettoyer l'historique des valeurs (>90 jours par défaut)
CREATE OR REPLACE FUNCTION cleanup_old_iot_values(retention_days INT DEFAULT 90)
RETURNS void AS $$
BEGIN
    DELETE FROM iot_device_values_history 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- 8. Vue pour le statut des dispositifs IoT
CREATE VIEW v_iot_devices_status AS
SELECT 
    d.id as device_id,
    d.nom as device_nom,
    d.identifiant_unique,
    d.statut,
    dt.nom as device_type_nom,
    a.code_interne as actif_code,
    a.description as actif_description,
    b.nom as broker_nom,
    b.is_connected as broker_connected,
    d.date_derniere_communication,
    d.mqtt_topic_base,
    COUNT(DISTINCT pc.id) as parameters_count,
    COUNT(DISTINCT CASE WHEN pc.is_active = true THEN pc.id END) as active_parameters_count
FROM iot_devices d
LEFT JOIN iot_device_types dt ON d.device_type_id = dt.id
LEFT JOIN actifs a ON d.actif_id = a.id
LEFT JOIN mqtt_brokers b ON d.mqtt_broker_id = b.id
LEFT JOIN iot_device_parameter_configs pc ON d.id = pc.device_id
GROUP BY d.id, dt.nom, a.code_interne, a.description, b.nom, b.is_connected;

-- 9. Vue pour les dernières valeurs des paramètres IoT
CREATE VIEW v_iot_device_latest_values AS
SELECT DISTINCT ON (device_id, parameter_id)
    device_id,
    parameter_id,
    valeur_text,
    valeur_number,
    valeur_boolean,
    valeur_date,
    timestamp,
    qualite
FROM iot_device_values_history
ORDER BY device_id, parameter_id, timestamp DESC;

-- 10. Insérer des types de dispositifs IoT par défaut
INSERT INTO iot_device_types (nom, description, icone) VALUES
('Capteur Température/Humidité', 'Capteur mesurant la température et l''humidité ambiante', 'thermometer'),
('Compteur Électrique', 'Compteur de consommation électrique intelligent', 'bolt'),
('Capteur de Pression', 'Capteur de pression industriel', 'gauge'),
('Détecteur d''Ouverture', 'Détecteur d''ouverture de porte ou de panneau', 'door-open'),
('Capteur Vibration', 'Capteur de vibration pour surveillance de machines', 'wave-square'),
('Capteur Multi-paramètres', 'Capteur IoT avec multiples paramètres configurables', 'microchip');

-- 11. Insérer des paramètres par défaut pour chaque type de dispositif
DO $$
DECLARE
    temp_humid_type_id UUID;
    power_meter_type_id UUID;
    pressure_type_id UUID;
    door_type_id UUID;
    vibration_type_id UUID;
    multi_type_id UUID;
BEGIN
    -- Capteur Température/Humidité
    SELECT id INTO temp_humid_type_id FROM iot_device_types WHERE nom = 'Capteur Température/Humidité';
    INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
    (temp_humid_type_id, 'temperature', 'Température', 'number', '°C', 1),
    (temp_humid_type_id, 'humidity', 'Humidité', 'number', '%', 2);

    -- Compteur Électrique
    SELECT id INTO power_meter_type_id FROM iot_device_types WHERE nom = 'Compteur Électrique';
    INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
    (power_meter_type_id, 'power_consumption', 'Consommation', 'number', 'kWh', 1),
    (power_meter_type_id, 'current', 'Courant', 'number', 'A', 2),
    (power_meter_type_id, 'voltage', 'Tension', 'number', 'V', 3),
    (power_meter_type_id, 'power_factor', 'Facteur de puissance', 'number', '', 4);

    -- Capteur de Pression
    SELECT id INTO pressure_type_id FROM iot_device_types WHERE nom = 'Capteur de Pression';
    INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
    (pressure_type_id, 'pressure', 'Pression', 'number', 'Pa', 1),
    (pressure_type_id, 'temperature', 'Température', 'number', '°C', 2);

    -- Détecteur d'Ouverture
    SELECT id INTO door_type_id FROM iot_device_types WHERE nom = 'Détecteur d''Ouverture';
    INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
    (door_type_id, 'door_status', 'État de la porte', 'boolean', '', 1),
    (door_type_id, 'last_opened', 'Dernière ouverture', 'date', '', 2);

    -- Capteur Vibration
    SELECT id INTO vibration_type_id FROM iot_device_types WHERE nom = 'Capteur Vibration';
    INSERT INTO iot_device_parameters (device_type_id, nom, libelle, type_donnee, unite, ordre) VALUES
    (vibration_type_id, 'vibration_level', 'Niveau de vibration', 'number', 'mm/s', 1),
    (vibration_type_id, 'frequency', 'Fréquence', 'number', 'Hz', 2),
    (vibration_type_id, 'alarm', 'Alarme', 'boolean', '', 3);

    -- Capteur Multi-paramètres (vide, l'utilisateur peut ajouter ses propres paramètres)
    SELECT id INTO multi_type_id FROM iot_device_types WHERE nom = 'Capteur Multi-paramètres';
END $$;

-- 12. Trigger pour mettre à jour la date de dernière communication
CREATE OR REPLACE FUNCTION update_iot_device_last_communication()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE iot_devices 
    SET date_derniere_communication = NOW(),
        updated_at = NOW()
    WHERE id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_iot_device_communication
    AFTER INSERT ON iot_device_values_history
    FOR EACH ROW
    EXECUTE FUNCTION update_iot_device_last_communication();

-- Migration completed successfully
-- IoT device management tables and default data are ready for use
