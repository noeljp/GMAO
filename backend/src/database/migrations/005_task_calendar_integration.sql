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
