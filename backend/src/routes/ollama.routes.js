const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const ollamaService = require('../services/ollama.service');
const pool = require('../config/database');

/**
 * POST /api/ollama/reformulate
 * Reformulate a description using Ollama LLM with context
 */
router.post('/reformulate',
  authenticate,
  [
    body('description').trim().notEmpty().withMessage('Description requise'),
    body('actif_id').optional().isUUID().withMessage('ID actif invalide'),
    body('type_intervention').optional().isString(),
    body('priorite').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const { description, actif_id, type_intervention, priorite } = req.body;

    // Build context
    const context = {};

    // Fetch asset information if actif_id is provided
    if (actif_id) {
      const actifResult = await pool.query(
        `SELECT a.id, a.code_interne, a.description, 
                ta.nom as type, a.localisation
         FROM actifs a
         LEFT JOIN types_actifs ta ON a.type_actif_id = ta.id
         WHERE a.id = $1 AND a.is_active = true`,
        [actif_id]
      );

      if (actifResult.rows.length > 0) {
        context.actif = actifResult.rows[0];
      }
    }

    if (type_intervention) {
      context.type_intervention = type_intervention;
    }

    if (priorite) {
      context.priorite = priorite;
    }

    // Call Ollama service
    const reformulatedDescription = await ollamaService.reformulateDescription(
      description,
      context
    );

    res.json({
      success: true,
      original: description,
      reformulated: reformulatedDescription,
      context_used: !!actif_id
    });
  })
);

/**
 * GET /api/ollama/health
 * Check Ollama service health
 */
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const isHealthy = await ollamaService.checkHealth();
    
    if (!isHealthy) {
      throw new AppError('Service Ollama non disponible', 503);
    }

    res.json({
      success: true,
      status: 'healthy',
      url: process.env.OLLAMA_URL || 'http://localhost:11434'
    });
  })
);

/**
 * GET /api/ollama/models
 * Get available Ollama models
 */
router.get('/models',
  authenticate,
  asyncHandler(async (req, res) => {
    const models = await ollamaService.getAvailableModels();
    
    res.json({
      success: true,
      models: models,
      current_model: process.env.OLLAMA_MODEL || 'llama2'
    });
  })
);

module.exports = router;
