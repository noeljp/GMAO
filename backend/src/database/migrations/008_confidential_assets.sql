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
