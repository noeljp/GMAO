const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const whisperService = require('../services/whisper.service');
const pool = require('../config/database');
const { logAudit } = require('../config/audit');
const logger = require('../config/logger');

/**
 * POST /api/whisper/transcribe/:documentId
 * Request transcription for an audio document
 */
router.post('/transcribe/:documentId',
  authenticate,
  requirePermission('documents.upload'), // Reuse document permission
  [
    body('businessContext').optional().isString().withMessage('Contexte métier doit être une chaîne'),
    body('technicalKeywords').optional().isString().withMessage('Mots techniques doivent être une chaîne'),
    body('language').optional().isString().isLength({ min: 2, max: 5 }).withMessage('Code langue invalide')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { documentId } = req.params;
    const { businessContext = '', technicalKeywords = '', language = 'fr' } = req.body;

    // Check if document exists and is an audio file
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND is_active = true',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new AppError('Document non trouvé', 404);
    }

    const document = docResult.rows[0];

    // Verify user has access to the document
    if (document.is_confidential && document.uploaded_by !== req.user.id) {
      throw new AppError('Accès non autorisé à ce document', 403);
    }

    // Check if it's an audio file
    if (!whisperService.isAudioFile(document.type_mime)) {
      throw new AppError('Le document doit être un fichier audio', 400);
    }

    // Check if file exists on disk
    if (!fs.existsSync(document.chemin)) {
      throw new AppError('Fichier audio non trouvé sur le serveur', 404);
    }

    // Check if transcription is already in progress or completed
    if (document.transcription_status === 'processing') {
      throw new AppError('Une transcription est déjà en cours pour ce fichier', 409);
    }

    // Mark transcription as processing
    await pool.query(
      `UPDATE documents 
       SET transcription_status = $1, 
           transcription_context = $2,
           transcription_keywords = $3,
           updated_at = NOW()
       WHERE id = $4`,
      ['processing', businessContext, technicalKeywords, documentId]
    );

    // Start transcription asynchronously (don't await)
    processTranscription(documentId, document, { businessContext, technicalKeywords, language }, req.user.id)
      .catch(error => {
        logger.error('Background transcription failed', {
          documentId,
          error: error.message
        });
      });

    logger.info('Transcription requested', {
      documentId,
      userId: req.user.id,
      hasContext: !!businessContext,
      hasKeywords: !!technicalKeywords
    });

    res.json({
      success: true,
      message: 'Transcription en cours. Le résultat apparaîtra bientôt dans vos documents.',
      documentId,
      status: 'processing'
    });
  })
);

/**
 * GET /api/whisper/status/:documentId
 * Get transcription status for a document
 */
router.get('/status/:documentId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const result = await pool.query(
      `SELECT id, titre, transcription_status, transcription_error, transcription_completed_at,
              (SELECT id FROM documents WHERE source_audio_id = $1 AND is_active = true LIMIT 1) as transcript_id
       FROM documents 
       WHERE id = $1 AND is_active = true`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Document non trouvé', 404);
    }

    const document = result.rows[0];

    res.json({
      documentId: document.id,
      status: document.transcription_status || 'not_requested',
      error: document.transcription_error,
      completedAt: document.transcription_completed_at,
      transcriptId: document.transcript_id
    });
  })
);

/**
 * GET /api/whisper/health
 * Check Whisper service health
 */
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const isHealthy = await whisperService.checkHealth();

    if (!isHealthy) {
      throw new AppError('Service Whisper non disponible', 503);
    }

    res.json({
      success: true,
      status: 'healthy',
      url: process.env.WHISPER_URL || 'http://localhost:8000',
      supportedFormats: whisperService.getSupportedFormats()
    });
  })
);

/**
 * Background function to process transcription
 * @param {string} documentId - Document ID
 * @param {object} document - Document object
 * @param {object} options - Transcription options
 * @param {string} userId - User ID who requested transcription
 */
async function processTranscription(documentId, document, options, userId) {
  try {
    logger.info('Starting background transcription', { documentId });

    // Call Whisper service
    const result = await whisperService.transcribeAudio(document.chemin, options);

    // Create a new document with the transcription
    const transcriptFileName = `${path.parse(document.nom_fichier).name}_transcript.txt`;
    const transcriptPath = path.join(path.dirname(document.chemin), `transcript_${Date.now()}.txt`);

    // Write transcription to file
    fs.writeFileSync(transcriptPath, result.text, 'utf-8');

    // Insert new document for the transcription
    const insertResult = await pool.query(
      `INSERT INTO documents (
        titre, nom_fichier, chemin, type_mime, taille, type, 
        description, uploaded_by, source_audio_id, is_confidential
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        `Transcription - ${document.titre}`,
        transcriptFileName,
        transcriptPath,
        'text/plain',
        Buffer.byteLength(result.text, 'utf-8'),
        'transcription',
        `Transcription automatique générée depuis ${document.nom_fichier}`,
        userId,
        documentId,
        document.is_confidential || false
      ]
    );

    const transcriptDoc = insertResult.rows[0];

    // Copy document liaisons from original audio to transcript
    await pool.query(
      `INSERT INTO documents_liaisons (document_id, objet_type, objet_id)
       SELECT $1, objet_type, objet_id
       FROM documents_liaisons
       WHERE document_id = $2`,
      [transcriptDoc.id, documentId]
    );

    // Update original document status to completed
    await pool.query(
      `UPDATE documents 
       SET transcription_status = $1,
           transcription_completed_at = NOW(),
           transcription_error = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      ['completed', documentId]
    );

    // Log audit
    await logAudit({
      userId,
      action: 'transcribe',
      tableName: 'documents',
      recordId: documentId,
      newValues: { transcriptId: transcriptDoc.id },
      ipAddress: null,
      userAgent: null
    });

    logger.info('Transcription completed successfully', {
      documentId,
      transcriptId: transcriptDoc.id,
      textLength: result.text.length
    });

  } catch (error) {
    logger.error('Transcription processing failed', {
      documentId,
      error: error.message,
      stack: error.stack
    });

    // Update document with error status
    await pool.query(
      `UPDATE documents 
       SET transcription_status = $1,
           transcription_error = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['failed', error.message, documentId]
    );
  }
}

module.exports = router;
