-- =====================================================
-- CONSOLIDATED MIGRATION: All Feature Enhancements
-- =====================================================
-- This migration consolidates all individual feature migrations:
-- - 002: Asset hierarchy and custom fields
-- - 003: MQTT integration  
-- - 004: Alert thresholds and preventive maintenance
-- - 005: Task calendar integration and resource management
-- - 006: Enhanced pieces catalog
-- - 007: IoT devices management
-- - 008: Confidential assets
-- - 009: Audio transcription
-- - 010: APRU40 IoT extension
-- =====================================================

-- Migration pour améliorer les actifs
-- Ajout de la hiérarchie parent-enfant et champs personnalisables

-- 1. Ajouter la relation parent-enfant aux actifs
ALTER TABLE actifs ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES actifs(id);
ALTER TABLE actifs ADD COLUMN IF NOT EXISTS niveau INT DEFAULT 0;
ALTER TABLE actifs ADD COLUMN IF NOT EXISTS chemin_hierarchique TEXT; -- Ex: /parent/enfant/petit-enfant

-- 2. Créer une table pour les types de champs personnalisables
CREATE TABLE IF NOT EXISTS actifs_champs_definition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_actif_id UUID REFERENCES actifs_types(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL, -- nom technique du champ (ex: capacite_electrique)
    libelle VARCHAR(255) NOT NULL, -- libellé affiché (ex: Capacité électrique)
    type_champ VARCHAR(50) NOT NULL, -- text, number, date, boolean, select, textarea
    unite VARCHAR(50), -- Pour les nombres (kW, L, kg, etc.)
    valeurs_possibles JSONB, -- Pour type=select: ["option1", "option2"]
    ordre INT DEFAULT 0,
    obligatoire BOOLEAN DEFAULT false,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Créer une table pour les valeurs des champs personnalisés
CREATE TABLE IF NOT EXISTS actifs_champs_valeurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actif_id UUID REFERENCES actifs(id) ON DELETE CASCADE,
    champ_definition_id UUID REFERENCES actifs_champs_definition(id) ON DELETE CASCADE,
    valeur_text TEXT,
    valeur_number DECIMAL(15,4),
    valeur_date DATE,
    valeur_boolean BOOLEAN,
    valeur_json JSONB, -- Pour stocker des structures complexes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(actif_id, champ_definition_id)
);

-- 4. Ajouter un index sur parent_id pour les requêtes hiérarchiques
CREATE INDEX IF NOT EXISTS idx_actifs_parent_id ON actifs(parent_id);
CREATE INDEX IF NOT EXISTS idx_actifs_niveau ON actifs(niveau);

-- 5. Créer une fonction pour calculer le chemin hiérarchique
CREATE OR REPLACE FUNCTION update_actif_chemin_hierarchique()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.chemin_hierarchique := '/' || NEW.code_interne;
        NEW.niveau := 0;
    ELSE
        SELECT 
            chemin_hierarchique || '/' || NEW.code_interne,
            niveau + 1
        INTO NEW.chemin_hierarchique, NEW.niveau
        FROM actifs
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Créer le trigger
DROP TRIGGER IF EXISTS trigger_actif_chemin_hierarchique ON actifs;
CREATE TRIGGER trigger_actif_chemin_hierarchique
    BEFORE INSERT OR UPDATE OF parent_id, code_interne ON actifs
    FOR EACH ROW
    EXECUTE FUNCTION update_actif_chemin_hierarchique();

-- 7. Ajouter des index pour les champs personnalisés
CREATE INDEX IF NOT EXISTS idx_actifs_champs_valeurs_actif ON actifs_champs_valeurs(actif_id);
CREATE INDEX IF NOT EXISTS idx_actifs_champs_valeurs_champ ON actifs_champs_valeurs(champ_definition_id);
CREATE INDEX IF NOT EXISTS idx_actifs_champs_definition_type ON actifs_champs_definition(type_actif_id);

-- 8. Ajouter des commentaires
COMMENT ON COLUMN actifs.parent_id IS 'Actif parent dans la hiérarchie (ex: un moteur peut être parent d''un roulement)';
COMMENT ON COLUMN actifs.niveau IS 'Niveau dans la hiérarchie (0=racine, 1=enfant direct, etc.)';
COMMENT ON COLUMN actifs.chemin_hierarchique IS 'Chemin complet dans la hiérarchie pour faciliter les requêtes';
COMMENT ON TABLE actifs_champs_definition IS 'Définition des champs personnalisables par type d''actif';
COMMENT ON TABLE actifs_champs_valeurs IS 'Valeurs des champs personnalisés pour chaque actif';
-- Migration pour intégration MQTT
-- Permet de récupérer des données depuis des brokers MQTT et mettre à jour les actifs

-- 1. Table des brokers MQTT
CREATE TABLE IF NOT EXISTS mqtt_brokers (
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
CREATE TABLE IF NOT EXISTS mqtt_subscriptions (
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
CREATE TABLE IF NOT EXISTS mqtt_actif_mappings (
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
CREATE TABLE IF NOT EXISTS mqtt_messages_log (
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
CREATE INDEX IF NOT EXISTS idx_mqtt_brokers_active ON mqtt_brokers(is_active);
CREATE INDEX IF NOT EXISTS idx_mqtt_subscriptions_broker ON mqtt_subscriptions(broker_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_subscriptions_active ON mqtt_subscriptions(broker_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mqtt_mappings_subscription ON mqtt_actif_mappings(subscription_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_mappings_actif ON mqtt_actif_mappings(actif_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_log_received ON mqtt_messages_log(received_at);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_log_broker ON mqtt_messages_log(broker_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_log_processed ON mqtt_messages_log(processed);

-- 6. Fonction pour nettoyer les vieux logs (>30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_mqtt_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM mqtt_messages_log 
    WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 7. Vues utiles
DROP VIEW IF EXISTS v_mqtt_status;
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
-- Migration 004: Seuils d'alerte et maintenance préventive automatique
-- Date: 2026-01-21
-- Description: Système de seuils sur les compteurs avec déclenchement automatique de maintenance préventive

-- =====================================================
-- 1. Table des seuils d'alerte sur les compteurs
-- =====================================================
CREATE TABLE IF NOT EXISTS actifs_seuils_alertes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actif_id UUID NOT NULL REFERENCES actifs(id) ON DELETE CASCADE,
    champ_definition_id UUID REFERENCES actifs_champs_definition(id) ON DELETE CASCADE,
    champ_standard VARCHAR(100), -- Si seuil sur champ standard
    
    -- Type de seuil
    type_seuil VARCHAR(20) NOT NULL CHECK (type_seuil IN ('superieur', 'inferieur', 'egal', 'entre')),
    valeur_seuil_min DECIMAL(15,2),
    valeur_seuil_max DECIMAL(15,2),
    
    -- Configuration de l'alerte
    niveau_alerte VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (niveau_alerte IN ('info', 'warning', 'critical')),
    message_alerte TEXT,
    actif BOOLEAN NOT NULL DEFAULT true,
    
    -- Action automatique
    action_automatique VARCHAR(50) CHECK (action_automatique IN ('notification', 'ordre_travail', 'notification_et_ordre')),
    template_maintenance_id UUID,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contrainte: soit champ_definition_id, soit champ_standard
    CONSTRAINT chk_seuil_champ CHECK (
        (champ_definition_id IS NOT NULL AND champ_standard IS NULL) OR
        (champ_definition_id IS NULL AND champ_standard IS NOT NULL)
    )
);

CREATE INDEX idx_seuils_actif ON actifs_seuils_alertes(actif_id) WHERE actif = true;
CREATE INDEX idx_seuils_champ_def ON actifs_seuils_alertes(champ_definition_id) WHERE actif = true;

-- =====================================================
-- 2. Templates de maintenance préventive (avant alertes_historique)
-- =====================================================
CREATE TABLE IF NOT EXISTS templates_maintenance_preventive (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Type de déclenchement
    type_declenchement VARCHAR(50) NOT NULL CHECK (type_declenchement IN ('seuil', 'temporel', 'manuel')),
    
    -- Configuration ordre de travail à créer
    priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
    type_intervention VARCHAR(50) DEFAULT 'preventif',
    duree_estimee_heures DECIMAL(5,2),
    
    -- Assignation
    equipe_id UUID,
    technicien_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    
    -- Instructions
    instructions TEXT,
    checklist JSONB, -- Liste de tâches à effectuer
    
    -- Pièces nécessaires
    pieces_necessaires JSONB, -- [{"code": "P001", "quantite": 2}, ...]
    
    -- Actif
    actif BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_by UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_actif ON templates_maintenance_preventive(actif) WHERE actif = true;
CREATE INDEX idx_templates_type ON templates_maintenance_preventive(type_declenchement);

-- Ajout foreign key après création de la table
ALTER TABLE actifs_seuils_alertes 
ADD CONSTRAINT fk_template_maintenance 
FOREIGN KEY (template_maintenance_id) REFERENCES templates_maintenance_preventive(id) ON DELETE SET NULL;

-- =====================================================
-- 3. Historique des déclenchements d'alertes
-- =====================================================
CREATE TABLE IF NOT EXISTS alertes_historique (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seuil_alerte_id UUID NOT NULL REFERENCES actifs_seuils_alertes(id) ON DELETE CASCADE,
    actif_id UUID NOT NULL REFERENCES actifs(id) ON DELETE CASCADE,
    
    -- Valeur qui a déclenché l'alerte
    valeur_declenchement DECIMAL(15,2),
    valeur_seuil DECIMAL(15,2),
    
    -- Informations
    niveau_alerte VARCHAR(20) NOT NULL,
    message TEXT,
    
    -- Actions prises
    notification_envoyee BOOLEAN DEFAULT false,
    ordre_travail_id UUID REFERENCES ordres_travail(id) ON DELETE SET NULL,
    
    -- Acquittement
    acquitte BOOLEAN DEFAULT false,
    acquitte_par UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    acquitte_at TIMESTAMP,
    commentaire_acquittement TEXT,
    
    -- Timestamp
    declenche_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alertes_actif ON alertes_historique(actif_id, declenche_at DESC);
CREATE INDEX idx_alertes_non_acquittees ON alertes_historique(acquitte) WHERE acquitte = false;
CREATE INDEX idx_alertes_seuil ON alertes_historique(seuil_alerte_id, declenche_at DESC);

-- =====================================================
-- 4. Gestion dynamique des options de champs select
-- =====================================================
CREATE TABLE IF NOT EXISTS actifs_champs_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    champ_definition_id UUID NOT NULL REFERENCES actifs_champs_definition(id) ON DELETE CASCADE,
    valeur VARCHAR(200) NOT NULL,
    libelle VARCHAR(200) NOT NULL,
    ordre INTEGER DEFAULT 0,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_champs_options_definition ON actifs_champs_options(champ_definition_id, ordre);

-- Migrer les options existantes depuis valeurs_possibles vers la table
INSERT INTO actifs_champs_options (champ_definition_id, valeur, libelle, ordre)
SELECT 
    id,
    opt->>'valeur',
    opt->>'libelle',
    (row_number() OVER (PARTITION BY id ORDER BY ord))::INTEGER - 1
FROM actifs_champs_definition,
     jsonb_array_elements(valeurs_possibles) WITH ORDINALITY AS t(opt, ord)
WHERE type_champ = 'select' AND valeurs_possibles IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. Vue des alertes actives
-- =====================================================
CREATE OR REPLACE VIEW v_alertes_actives AS
SELECT 
    ah.id,
    ah.seuil_alerte_id,
    ah.actif_id,
    a.code_interne as actif_code,
    a.description as actif_description,
    asa.message_alerte,
    ah.valeur_declenchement,
    ah.valeur_seuil,
    ah.niveau_alerte,
    ah.message,
    ah.notification_envoyee,
    ah.ordre_travail_id,
    ah.declenche_at,
    
    -- Info seuil
    asa.type_seuil,
    COALESCE(acd.libelle, asa.champ_standard) as champ_libelle,
    
    -- Acquittement
    ah.acquitte,
    ah.acquitte_par,
    u.prenom || ' ' || u.nom as acquitte_par_nom,
    ah.acquitte_at,
    ah.commentaire_acquittement
FROM alertes_historique ah
JOIN actifs_seuils_alertes asa ON ah.seuil_alerte_id = asa.id
JOIN actifs a ON ah.actif_id = a.id
LEFT JOIN actifs_champs_definition acd ON asa.champ_definition_id = acd.id
LEFT JOIN utilisateurs u ON ah.acquitte_par = u.id
WHERE ah.acquitte = false
ORDER BY 
    CASE ah.niveau_alerte
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
    END,
    ah.declenche_at DESC;

-- =====================================================
-- 6. Fonction de vérification des seuils
-- =====================================================
CREATE OR REPLACE FUNCTION verifier_seuils_alerte(
    p_actif_id UUID,
    p_champ_definition_id UUID,
    p_champ_standard VARCHAR,
    p_nouvelle_valeur DECIMAL
) RETURNS TABLE (
    seuil_id UUID,
    seuil_depasse BOOLEAN,
    action_automatique VARCHAR,
    template_id UUID,
    niveau_alerte VARCHAR,
    message_alerte TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        asa.id,
        CASE 
            WHEN asa.type_seuil = 'superieur' THEN p_nouvelle_valeur > asa.valeur_seuil_min
            WHEN asa.type_seuil = 'inferieur' THEN p_nouvelle_valeur < asa.valeur_seuil_min
            WHEN asa.type_seuil = 'egal' THEN p_nouvelle_valeur = asa.valeur_seuil_min
            WHEN asa.type_seuil = 'entre' THEN p_nouvelle_valeur BETWEEN asa.valeur_seuil_min AND asa.valeur_seuil_max
            ELSE false
        END as seuil_depasse,
        asa.action_automatique,
        asa.template_maintenance_id,
        asa.niveau_alerte,
        COALESCE(
            asa.message_alerte,
            'Seuil atteint: ' || p_nouvelle_valeur::TEXT
        ) as message_alerte
    FROM actifs_seuils_alertes asa
    WHERE asa.actif_id = p_actif_id
      AND asa.actif = true
      AND (
          (p_champ_definition_id IS NOT NULL AND asa.champ_definition_id = p_champ_definition_id)
          OR
          (p_champ_standard IS NOT NULL AND asa.champ_standard = p_champ_standard)
      );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Fonction de création automatique d'ordre de travail
-- =====================================================
CREATE OR REPLACE FUNCTION creer_ordre_travail_preventif(
    p_template_id UUID,
    p_actif_id UUID,
    p_alerte_id UUID
) RETURNS UUID AS $$
DECLARE
    v_ordre_id UUID;
    v_template templates_maintenance_preventive%ROWTYPE;
BEGIN
    -- Récupérer le template
    SELECT * INTO v_template FROM templates_maintenance_preventive WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Créer l'ordre de travail
    INSERT INTO ordres_travail (
        actif_id,
        titre,
        description,
        type_intervention,
        priorite,
        statut,
        duree_estimee_heures,
        equipe_assignee_id,
        technicien_assigne_id,
        instructions,
        created_at
    ) VALUES (
        p_actif_id,
        'Maintenance préventive: ' || v_template.nom,
        'Ordre créé automatiquement suite à alerte #' || p_alerte_id || E'\n\n' || COALESCE(v_template.description, ''),
        v_template.type_intervention,
        v_template.priorite,
        'nouveau',
        v_template.duree_estimee_heures,
        v_template.equipe_id,
        v_template.technicien_id,
        v_template.instructions,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO v_ordre_id;
    
    -- Mettre à jour l'alerte avec l'ordre créé
    UPDATE alertes_historique 
    SET ordre_travail_id = v_ordre_id
    WHERE id = p_alerte_id;
    
    RETURN v_ordre_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Trigger pour mettre à jour updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_seuils_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seuils_updated_at
    BEFORE UPDATE ON actifs_seuils_alertes
    FOR EACH ROW
    EXECUTE FUNCTION update_seuils_updated_at();

CREATE TRIGGER trigger_templates_updated_at
    BEFORE UPDATE ON templates_maintenance_preventive
    FOR EACH ROW
    EXECUTE FUNCTION update_seuils_updated_at();

-- =====================================================
-- 9. Fonction de nettoyage des anciennes alertes acquittées
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_alertes()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Supprimer les alertes acquittées de plus de 90 jours
    DELETE FROM alertes_historique
    WHERE acquitte = true 
      AND acquitte_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. Commentaires
-- =====================================================
COMMENT ON TABLE actifs_seuils_alertes IS 'Seuils d''alerte configurables sur les compteurs et champs d''actifs';
COMMENT ON TABLE alertes_historique IS 'Historique des déclenchements d''alertes avec acquittement';
COMMENT ON TABLE templates_maintenance_preventive IS 'Templates pour génération automatique d''ordres de travail préventifs';
COMMENT ON TABLE actifs_champs_options IS 'Options dynamiques pour les champs de type select';

-- Message de fin
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration 004 terminée: Seuils d''alerte et maintenance préventive';
END $$;
-- Migration 005: Task Calendar Integration and Resource Management
-- This migration adds support for:
-- 1. Resource types and resource allocation tracking
-- 2. Enhanced task scheduling with conflict detection
-- 3. Better calendar integration fields

-- Create resource types table (human and material resources)
CREATE TABLE IF NOT EXISTS resource_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'humain' ou 'materiel'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type_id UUID REFERENCES resource_types(id),
    nom VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    -- For human resources
    utilisateur_id UUID REFERENCES utilisateurs(id),
    -- For material resources
    quantite_disponible INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create resource allocations table to track resource usage per task
CREATE TABLE IF NOT EXISTS resource_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordre_travail_id UUID REFERENCES ordres_travail(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id),
    quantite_requise INT DEFAULT 1,
    date_debut TIMESTAMP NOT NULL,
    date_fin TIMESTAMP NOT NULL,
    statut VARCHAR(50) DEFAULT 'planifie', -- planifie, confirme, en_cours, termine, annule
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    CONSTRAINT valid_dates CHECK (date_fin > date_debut)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_allocations_ordre ON resource_allocations(ordre_travail_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_resource ON resource_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_dates ON resource_allocations(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type_id);
CREATE INDEX IF NOT EXISTS idx_resources_utilisateur ON resources(utilisateur_id);

-- Add missing columns to ordres_travail for better calendar integration
-- Note: date_prevue is used as an alias for date_prevue_debut in many queries
ALTER TABLE ordres_travail ADD COLUMN IF NOT EXISTS date_prevue TIMESTAMP;

-- Add color coding for calendar display
ALTER TABLE ordres_travail ADD COLUMN IF NOT EXISTS couleur VARCHAR(7);

-- Add conflict tracking
ALTER TABLE ordres_travail ADD COLUMN IF NOT EXISTS has_conflicts BOOLEAN DEFAULT false;
ALTER TABLE ordres_travail ADD COLUMN IF NOT EXISTS conflict_details JSONB;

-- Create a view for easier resource availability checking
CREATE OR REPLACE VIEW resource_availability AS
SELECT 
    r.id as resource_id,
    r.nom as resource_nom,
    r.code as resource_code,
    r.quantite_disponible,
    ra.ordre_travail_id,
    ra.date_debut,
    ra.date_fin,
    ra.quantite_requise,
    ra.statut as allocation_statut,
    ot.titre as ordre_titre,
    ot.statut as ordre_statut
FROM resources r
LEFT JOIN resource_allocations ra ON r.id = ra.resource_id
LEFT JOIN ordres_travail ot ON ra.ordre_travail_id = ot.id
WHERE r.is_active = true;

-- Create function to check resource conflicts
CREATE OR REPLACE FUNCTION check_resource_conflict(
    p_resource_id UUID,
    p_date_debut TIMESTAMP,
    p_date_fin TIMESTAMP,
    p_quantite_requise INT,
    p_exclude_allocation_id UUID DEFAULT NULL
) RETURNS TABLE (
    has_conflict BOOLEAN,
    conflicting_allocation_id UUID,
    conflicting_ordre_id UUID,
    conflicting_ordre_titre VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true as has_conflict,
        ra.id as conflicting_allocation_id,
        ra.ordre_travail_id as conflicting_ordre_id,
        ot.titre as conflicting_ordre_titre
    FROM resource_allocations ra
    JOIN ordres_travail ot ON ra.ordre_travail_id = ot.id
    JOIN resources r ON ra.resource_id = r.id
    WHERE ra.resource_id = p_resource_id
        AND ra.statut IN ('planifie', 'confirme', 'en_cours')
        AND (p_exclude_allocation_id IS NULL OR ra.id != p_exclude_allocation_id)
        AND (
            -- Check for overlapping time periods
            (p_date_debut, p_date_fin) OVERLAPS (ra.date_debut, ra.date_fin)
        )
        -- Check if total allocated quantity exceeds available quantity
        AND (
            SELECT COALESCE(SUM(ra2.quantite_requise), 0) + p_quantite_requise
            FROM resource_allocations ra2
            WHERE ra2.resource_id = p_resource_id
                AND ra2.statut IN ('planifie', 'confirme', 'en_cours')
                AND (p_exclude_allocation_id IS NULL OR ra2.id != p_exclude_allocation_id)
                AND (p_date_debut, p_date_fin) OVERLAPS (ra2.date_debut, ra2.date_fin)
        ) > r.quantite_disponible;
END;
$$ LANGUAGE plpgsql;

-- Insert default resource types
INSERT INTO resource_types (nom, type, description) VALUES
    ('Technicien', 'humain', 'Personnel technique de maintenance'),
    ('Ingénieur', 'humain', 'Ingénieur de maintenance'),
    ('Outil Électrique', 'materiel', 'Outils électriques'),
    ('Outil Mécanique', 'materiel', 'Outils mécaniques'),
    ('Véhicule', 'materiel', 'Véhicules de service'),
    ('Équipement de Sécurité', 'materiel', 'EPI et équipements de sécurité')
ON CONFLICT DO NOTHING;

-- Create a trigger to update date_prevue from date_prevue_debut
CREATE OR REPLACE FUNCTION sync_date_prevue() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_prevue_debut IS NOT NULL AND NEW.date_prevue IS NULL THEN
        NEW.date_prevue := NEW.date_prevue_debut;
    END IF;
    IF NEW.date_prevue IS NOT NULL AND NEW.date_prevue_debut IS NULL THEN
        NEW.date_prevue_debut := NEW.date_prevue;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_date_prevue
    BEFORE INSERT OR UPDATE ON ordres_travail
    FOR EACH ROW
    EXECUTE FUNCTION sync_date_prevue();

-- Add comments for documentation
COMMENT ON TABLE resource_types IS 'Types de ressources (humaines ou matérielles)';
COMMENT ON TABLE resources IS 'Ressources disponibles pour les tâches de maintenance';
COMMENT ON TABLE resource_allocations IS 'Allocations de ressources aux ordres de travail';
COMMENT ON FUNCTION check_resource_conflict IS 'Vérifie les conflits de ressources pour une allocation donnée';
-- Migration 006: Enhanced Pieces Catalog
-- Amélioration du catalogue de pièces de remplacement avec gestion de stock avancée

-- 1. Modifier la table pieces existante pour ajouter les nouveaux champs
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS reference_interne VARCHAR(100);
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS fournisseur VARCHAR(255);
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS site_internet_fournisseur VARCHAR(500);
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS quantite_stock INT DEFAULT 0;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS seuil_minimum INT DEFAULT 0;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS prix_indicatif DECIMAL(10,2);
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS remarques TEXT;

-- Note: We maintain both old and new field names for backward compatibility:
-- - quantite_stock (new) and stock_actuel (old) 
-- - seuil_minimum (new) and stock_min (old)
-- - prix_indicatif (new) and prix_unitaire (old)
-- This allows gradual migration of code using the old field names

-- 2. Créer une table d'association entre pièces et actifs
CREATE TABLE IF NOT EXISTS pieces_actifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    piece_id UUID REFERENCES pieces(id) ON DELETE CASCADE,
    actif_id UUID REFERENCES actifs(id) ON DELETE CASCADE,
    quantite_necessaire INT DEFAULT 1,
    remarques TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    UNIQUE(piece_id, actif_id)
);

-- 3. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_pieces_reference_interne ON pieces(reference_interne);
CREATE INDEX IF NOT EXISTS idx_pieces_reference_fabricant ON pieces(reference_fabricant);
CREATE INDEX IF NOT EXISTS idx_pieces_fournisseur ON pieces(fournisseur);
CREATE INDEX IF NOT EXISTS idx_pieces_stock ON pieces(quantite_stock, seuil_minimum);
CREATE INDEX IF NOT EXISTS idx_pieces_actifs_piece ON pieces_actifs(piece_id);
CREATE INDEX IF NOT EXISTS idx_pieces_actifs_actif ON pieces_actifs(actif_id);

-- 4. Créer une vue pour faciliter les requêtes avec alertes de stock
CREATE OR REPLACE VIEW pieces_avec_alertes AS
SELECT 
    p.*,
    CASE 
        WHEN p.quantite_stock <= p.seuil_minimum THEN 'critique'
        WHEN p.quantite_stock <= (p.seuil_minimum * 1.5) THEN 'attention'
        ELSE 'ok'
    END as statut_stock,
    (SELECT COUNT(*) FROM pieces_actifs pa WHERE pa.piece_id = p.id) as nombre_actifs_associes
FROM pieces p
WHERE p.is_active = true;

-- 5. Ajouter des commentaires pour documentation
COMMENT ON TABLE pieces IS 'Catalogue de pièces de remplacement pour la maintenance';
COMMENT ON COLUMN pieces.reference_interne IS 'Référence interne de la pièce dans le système';
COMMENT ON COLUMN pieces.reference_fabricant IS 'Référence du fabricant';
COMMENT ON COLUMN pieces.fournisseur IS 'Nom du fournisseur principal';
COMMENT ON COLUMN pieces.site_internet_fournisseur IS 'URL du site web du fournisseur';
COMMENT ON COLUMN pieces.quantite_stock IS 'Quantité actuellement en stock';
COMMENT ON COLUMN pieces.seuil_minimum IS 'Seuil minimum de stock avant alerte';
COMMENT ON COLUMN pieces.prix_indicatif IS 'Prix indicatif unitaire';

COMMENT ON TABLE pieces_actifs IS 'Association entre pièces et actifs - plusieurs actifs peuvent utiliser la même pièce';
COMMENT ON COLUMN pieces_actifs.quantite_necessaire IS 'Quantité de cette pièce nécessaire pour cet actif';
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
-- Migration: Add confidentiality support for assets, requests, work orders, and documents
-- This allows users to create confidential items that are only visible to them

-- Add is_confidential column to actifs table
ALTER TABLE actifs 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_actifs_confidential ON actifs(is_confidential, created_by);

-- Add is_confidential column to demandes_intervention table
ALTER TABLE demandes_intervention 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_demandes_confidential ON demandes_intervention(is_confidential, demandeur_id);

-- Add is_confidential column to ordres_travail table
ALTER TABLE ordres_travail 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ordres_travail_confidential ON ordres_travail(is_confidential, created_by);

-- Add is_confidential column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_confidential ON documents(is_confidential, uploaded_by);

-- Add comment to explain the feature
COMMENT ON COLUMN actifs.is_confidential IS 'When true, this asset is only visible to the user who created it';
COMMENT ON COLUMN demandes_intervention.is_confidential IS 'When true, this request is only visible to the user who submitted it';
COMMENT ON COLUMN ordres_travail.is_confidential IS 'When true, this work order is only visible to the user who created it';
COMMENT ON COLUMN documents.is_confidential IS 'When true, this document is only visible to the user who uploaded it';
-- Migration for Audio Transcription Feature
-- Adds support for audio file transcription using FasterWhisper API

-- Add transcription-related columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50) DEFAULT NULL, -- pending, processing, completed, failed
ADD COLUMN IF NOT EXISTS source_audio_id UUID REFERENCES documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transcription_context TEXT, -- Business context provided by user
ADD COLUMN IF NOT EXISTS transcription_keywords TEXT, -- Technical keywords/acronyms for better transcription
ADD COLUMN IF NOT EXISTS transcription_error TEXT, -- Error message if transcription failed
ADD COLUMN IF NOT EXISTS transcription_completed_at TIMESTAMP;

-- Create index on transcription_status for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_transcription_status ON documents(transcription_status);

-- Create index on source_audio_id for linking transcripts to audio files
CREATE INDEX IF NOT EXISTS idx_documents_source_audio ON documents(source_audio_id);

-- Comment on new columns
COMMENT ON COLUMN documents.transcription_status IS 'Status of transcription: pending, processing, completed, failed';
COMMENT ON COLUMN documents.source_audio_id IS 'Reference to the original audio file if this document is a transcription';
COMMENT ON COLUMN documents.transcription_context IS 'Business context provided for better transcription accuracy';
COMMENT ON COLUMN documents.transcription_keywords IS 'Technical keywords and acronyms to help the voice-to-text model';
COMMENT ON COLUMN documents.transcription_error IS 'Error message if transcription failed';
COMMENT ON COLUMN documents.transcription_completed_at IS 'Timestamp when transcription was completed';
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
    d.version_firmware as firmware_version,
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
