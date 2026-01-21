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

-- Migrer les options existantes depuis options_liste_json vers la table
INSERT INTO actifs_champs_options (champ_definition_id, valeur, libelle, ordre)
SELECT 
    id,
    opt->>'valeur',
    opt->>'libelle',
    (row_number() OVER (PARTITION BY id ORDER BY ord))::INTEGER - 1
FROM actifs_champs_definition,
     jsonb_array_elements(options_liste_json) WITH ORDINALITY AS t(opt, ord)
WHERE type_champ = 'select' AND options_liste_json IS NOT NULL
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
