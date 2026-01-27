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
