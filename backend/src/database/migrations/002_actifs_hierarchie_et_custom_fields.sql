-- Migration pour améliorer les actifs
-- Ajout de la hiérarchie parent-enfant et champs personnalisables

-- 1. Ajouter la relation parent-enfant aux actifs
ALTER TABLE actifs ADD COLUMN parent_id UUID REFERENCES actifs(id);
ALTER TABLE actifs ADD COLUMN niveau INT DEFAULT 0;
ALTER TABLE actifs ADD COLUMN chemin_hierarchique TEXT; -- Ex: /parent/enfant/petit-enfant

-- 2. Créer une table pour les types de champs personnalisables
CREATE TABLE actifs_champs_definition (
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
CREATE TABLE actifs_champs_valeurs (
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
CREATE INDEX idx_actifs_parent_id ON actifs(parent_id);
CREATE INDEX idx_actifs_niveau ON actifs(niveau);

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
CREATE TRIGGER trigger_actif_chemin_hierarchique
    BEFORE INSERT OR UPDATE OF parent_id, code_interne ON actifs
    FOR EACH ROW
    EXECUTE FUNCTION update_actif_chemin_hierarchique();

-- 7. Ajouter des index pour les champs personnalisés
CREATE INDEX idx_actifs_champs_valeurs_actif ON actifs_champs_valeurs(actif_id);
CREATE INDEX idx_actifs_champs_valeurs_champ ON actifs_champs_valeurs(champ_definition_id);
CREATE INDEX idx_actifs_champs_definition_type ON actifs_champs_definition(type_actif_id);

-- 8. Ajouter des commentaires
COMMENT ON COLUMN actifs.parent_id IS 'Actif parent dans la hiérarchie (ex: un moteur peut être parent d''un roulement)';
COMMENT ON COLUMN actifs.niveau IS 'Niveau dans la hiérarchie (0=racine, 1=enfant direct, etc.)';
COMMENT ON COLUMN actifs.chemin_hierarchique IS 'Chemin complet dans la hiérarchie pour faciliter les requêtes';
COMMENT ON TABLE actifs_champs_definition IS 'Définition des champs personnalisables par type d''actif';
COMMENT ON TABLE actifs_champs_valeurs IS 'Valeurs des champs personnalisés pour chaque actif';
