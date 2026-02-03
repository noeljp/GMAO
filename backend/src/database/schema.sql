-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- A) Sites et structure
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE TABLE batiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    code VARCHAR(50) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batiment_id UUID REFERENCES batiments(id),
    code VARCHAR(50) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE localisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    parent_id UUID REFERENCES localisations(id),
    zone_id UUID REFERENCES zones(id),
    code VARCHAR(50) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- B) Utilisateurs et permissions
CREATE TABLE utilisateurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    telephone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE equipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE utilisateurs_equipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id),
    equipe_id UUID REFERENCES equipes(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(utilisateur_id, equipe_id)
);

-- C) Actifs
CREATE TABLE actifs_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actifs_fabricants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    contact TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actifs_statuts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    couleur VARCHAR(7),
    ordre INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actifs_criticites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    niveau INT,
    couleur VARCHAR(7),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    localisation_id UUID REFERENCES localisations(id),
    type_id UUID REFERENCES actifs_types(id),
    fabricant_id UUID REFERENCES actifs_fabricants(id),
    statut_id UUID REFERENCES actifs_statuts(id),
    criticite_id UUID REFERENCES actifs_criticites(id),
    code_interne VARCHAR(100) UNIQUE NOT NULL,
    numero_serie VARCHAR(100),
    description TEXT,
    date_mise_en_service DATE,
    parent_id UUID REFERENCES actifs(id),
    niveau INT DEFAULT 0,
    chemin_hierarchique TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    updated_by UUID REFERENCES utilisateurs(id)
);

-- Index pour hiérarchie
CREATE INDEX idx_actifs_parent_id ON actifs(parent_id);
CREATE INDEX idx_actifs_niveau ON actifs(niveau);

-- Fonction pour calculer le chemin hiérarchique
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

-- Trigger pour chemin hiérarchique
CREATE TRIGGER trigger_actif_chemin_hierarchique
    BEFORE INSERT OR UPDATE OF parent_id, code_interne ON actifs
    FOR EACH ROW
    EXECUTE FUNCTION update_actif_chemin_hierarchique();

-- Tables pour champs personnalisables
CREATE TABLE actifs_champs_definition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_actif_id UUID REFERENCES actifs_types(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    type_champ VARCHAR(50) NOT NULL,
    unite VARCHAR(50),
    valeurs_possibles JSONB,
    ordre INT DEFAULT 0,
    obligatoire BOOLEAN DEFAULT false,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actifs_champs_valeurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actif_id UUID REFERENCES actifs(id) ON DELETE CASCADE,
    champ_definition_id UUID REFERENCES actifs_champs_definition(id) ON DELETE CASCADE,
    valeur_text TEXT,
    valeur_number DECIMAL(15,4),
    valeur_date DATE,
    valeur_boolean BOOLEAN,
    valeur_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(actif_id, champ_definition_id)
);

CREATE INDEX idx_actifs_champs_valeurs_actif ON actifs_champs_valeurs(actif_id);
CREATE INDEX idx_actifs_champs_valeurs_champ ON actifs_champs_valeurs(champ_definition_id);
CREATE INDEX idx_actifs_champs_definition_type ON actifs_champs_definition(type_actif_id);

-- Commentaires
COMMENT ON COLUMN actifs.parent_id IS 'Actif parent dans la hiérarchie (ex: un moteur peut être parent d''un roulement)';
COMMENT ON COLUMN actifs.niveau IS 'Niveau dans la hiérarchie (0=racine, 1=enfant direct, etc.)';
COMMENT ON COLUMN actifs.chemin_hierarchique IS 'Chemin complet dans la hiérarchie pour faciliter les requêtes';
COMMENT ON TABLE actifs_champs_definition IS 'Définition des champs personnalisables par type d''actif';
COMMENT ON TABLE actifs_champs_valeurs IS 'Valeurs des champs personnalisés pour chaque actif';

-- D) Demandes d'intervention
CREATE TABLE demandes_intervention (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    actif_id UUID REFERENCES actifs(id),
    demandeur_id UUID REFERENCES utilisateurs(id),
    priorite VARCHAR(50),
    type VARCHAR(50),
    statut VARCHAR(50) DEFAULT 'soumise',
    date_souhaitee TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- E) Ordres de travail
CREATE TABLE ordres_travail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    actif_id UUID REFERENCES actifs(id),
    demande_id UUID REFERENCES demandes_intervention(id),
    type VARCHAR(50), -- preventif, correctif, amelioration
    priorite VARCHAR(50),
    statut VARCHAR(50) DEFAULT 'planifie',
    technicien_id UUID REFERENCES utilisateurs(id),
    equipe_id UUID REFERENCES equipes(id),
    date_prevue_debut TIMESTAMP,
    date_prevue_fin TIMESTAMP,
    date_debut_reel TIMESTAMP,
    date_fin_reel TIMESTAMP,
    duree_estimee INT, -- en minutes
    duree_reelle INT, -- en minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES utilisateurs(id),
    updated_by UUID REFERENCES utilisateurs(id)
);

-- F) Interventions (actions sur les OT)
CREATE TABLE interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordre_travail_id UUID REFERENCES ordres_travail(id),
    technicien_id UUID REFERENCES utilisateurs(id),
    date_debut TIMESTAMP NOT NULL,
    date_fin TIMESTAMP,
    description_travaux TEXT,
    remarques TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- G) Pièces détachées
CREATE TABLE pieces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    reference_fabricant VARCHAR(100),
    prix_unitaire DECIMAL(10,2),
    unite VARCHAR(50),
    stock_min INT,
    stock_actuel INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE interventions_pieces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intervention_id UUID REFERENCES interventions(id),
    piece_id UUID REFERENCES pieces(id),
    quantite INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- H) Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags_liaisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID REFERENCES tags(id),
    objet_type VARCHAR(50) NOT NULL, -- actif, ot, demande, etc.
    objet_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tag_id, objet_type, objet_id)
);

-- Indexes pour améliorer les performances
CREATE INDEX idx_actifs_site ON actifs(site_id);
CREATE INDEX idx_actifs_type ON actifs(type_id);
CREATE INDEX idx_actifs_statut ON actifs(statut_id);
CREATE INDEX idx_ordres_travail_actif ON ordres_travail(actif_id);
CREATE INDEX idx_ordres_travail_technicien ON ordres_travail(technicien_id);
CREATE INDEX idx_ordres_travail_statut ON ordres_travail(statut);
CREATE INDEX idx_demandes_actif ON demandes_intervention(actif_id);
CREATE INDEX idx_demandes_demandeur ON demandes_intervention(demandeur_id);
CREATE INDEX idx_tags_liaisons_objet ON tags_liaisons(objet_type, objet_id);

-- I) Système de rôles et permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    niveau INT NOT NULL, -- 1=admin, 2=manager, 3=technicien, 4=user
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL, -- sites, actifs, ot, demandes, users, etc.
    action VARCHAR(50) NOT NULL, -- read, create, update, delete, approve
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE utilisateurs_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(utilisateur_id, role_id)
);

-- J) Audit Trail
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id),
    action VARCHAR(50) NOT NULL, -- create, update, delete, login, logout
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(utilisateur_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- K) Documents et fichiers
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    nom_fichier VARCHAR(255) NOT NULL,
    chemin VARCHAR(500) NOT NULL,
    type_mime VARCHAR(100),
    taille BIGINT, -- en bytes
    type VARCHAR(50), -- manuel, photo, schema, procedure, rapport
    description TEXT,
    uploaded_by UUID REFERENCES utilisateurs(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE documents_liaisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    objet_type VARCHAR(50) NOT NULL, -- actif, ot, demande, site
    objet_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, objet_type, objet_id)
);

CREATE INDEX idx_documents_liaisons ON documents_liaisons(objet_type, objet_id);

-- L) Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- info, warning, error, success
    objet_type VARCHAR(50), -- ot, demande, actif
    objet_id UUID,
    lu BOOLEAN DEFAULT false,
    lu_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(utilisateur_id, lu);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- M) Workflows et transitions
CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entite VARCHAR(50) NOT NULL, -- ot, demande
    statut_source VARCHAR(50) NOT NULL,
    statut_destination VARCHAR(50) NOT NULL,
    roles_autorises TEXT[], -- array de roles autorisés
    conditions JSONB, -- conditions à vérifier
    actions JSONB, -- actions à exécuter (notifications, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflow_historique (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entite VARCHAR(50) NOT NULL,
    entite_id UUID NOT NULL,
    statut_source VARCHAR(50),
    statut_destination VARCHAR(50) NOT NULL,
    utilisateur_id UUID REFERENCES utilisateurs(id),
    commentaire TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_historique ON workflow_historique(entite, entite_id);

-- N) Statistiques et cache
CREATE TABLE statistiques_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cle VARCHAR(100) UNIQUE NOT NULL,
    valeur JSONB NOT NULL,
    expire_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stats_cache_key ON statistiques_cache(cle, expire_at);

-- O) MQTT Integration
-- Table des brokers MQTT
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

-- Table des souscriptions MQTT (topics)
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

-- Table de mapping entre topics MQTT et champs d'actifs
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

-- Table d'historique des messages MQTT reçus
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

-- Index pour performance MQTT
CREATE INDEX idx_mqtt_brokers_active ON mqtt_brokers(is_active);
CREATE INDEX idx_mqtt_subscriptions_broker ON mqtt_subscriptions(broker_id);
CREATE INDEX idx_mqtt_subscriptions_active ON mqtt_subscriptions(broker_id, is_active);
CREATE INDEX idx_mqtt_mappings_subscription ON mqtt_actif_mappings(subscription_id);
CREATE INDEX idx_mqtt_mappings_actif ON mqtt_actif_mappings(actif_id);
CREATE INDEX idx_mqtt_messages_log_received ON mqtt_messages_log(received_at);
CREATE INDEX idx_mqtt_messages_log_broker ON mqtt_messages_log(broker_id);
CREATE INDEX idx_mqtt_messages_log_processed ON mqtt_messages_log(processed);

-- Vue de statut MQTT
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

-- Fonction pour nettoyer les vieux logs MQTT (>30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_mqtt_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM mqtt_messages_log 
    WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Commentaires MQTT
COMMENT ON TABLE mqtt_brokers IS 'Configuration des brokers MQTT (Mosquitto, HiveMQ, etc.)';
COMMENT ON TABLE mqtt_subscriptions IS 'Topics MQTT auxquels souscrire';
COMMENT ON TABLE mqtt_actif_mappings IS 'Mapping entre données MQTT et champs d''actifs';
COMMENT ON TABLE mqtt_messages_log IS 'Historique des messages MQTT reçus';
COMMENT ON COLUMN mqtt_actif_mappings.json_path IS 'Chemin JSONPath pour extraire la valeur (ex: $.temperature, $.data.counter)';
COMMENT ON COLUMN mqtt_actif_mappings.transformation IS 'Transformation à appliquer: none, multiply, divide, round, floor, ceil';

