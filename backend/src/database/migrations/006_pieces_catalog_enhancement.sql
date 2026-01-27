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

-- Renommer les colonnes existantes si nécessaire pour cohérence
-- stock_actuel -> quantite_stock (si pas déjà fait)
-- stock_min -> seuil_minimum (si pas déjà fait)
-- prix_unitaire -> prix_indicatif (garder les deux pour compatibilité)

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
