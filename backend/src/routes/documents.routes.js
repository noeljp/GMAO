const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { upload, handleMulterError, uploadsDir } = require('../config/upload');
const { logAudit } = require('../config/audit');
const logger = require('../config/logger');

// Upload un fichier (route /upload pour compatibilité frontend)
router.post('/upload', 
  authenticate,
  requirePermission('documents.upload'),
  upload.single('file'),
  handleMulterError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Aucun fichier fourni', 400);
    }

    const { titre, type, description, objet_type, objet_id, is_confidential } = req.body;

    if (!titre || !type) {
      // Supprimer le fichier uploadé si validation échoue
      fs.unlinkSync(req.file.path);
      throw new AppError('Titre et type requis', 400);
    }

    // Insérer le document
    const result = await pool.query(
      `INSERT INTO documents (titre, nom_fichier, chemin, type_mime, taille, type, description, is_confidential, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titre,
        req.file.filename,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        type,
        description || null,
        is_confidential || false,
        req.user.id
      ]
    );

    const document = result.rows[0];

    // Lier à un objet si spécifié
    if (objet_type && objet_id) {
      await pool.query(
        `INSERT INTO documents_liaisons (document_id, objet_type, objet_id)
         VALUES ($1, $2, $3)`,
        [document.id, objet_type, objet_id]
      );
    }

    // Audit
    await logAudit({
      userId: req.user.id,
      action: 'upload',
      tableName: 'documents',
      recordId: document.id,
      newValues: document,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Document uploaded', { 
      documentId: document.id, 
      userId: req.user.id,
      filename: req.file.filename 
    });

    res.status(201).json(document);
  })
);

// Upload un fichier (route alternative)
router.post('/', 
  authenticate,
  requirePermission('documents.upload'),
  upload.single('file'),
  handleMulterError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('Aucun fichier fourni', 400);
    }

    const { titre, type, description, objet_type, objet_id, is_confidential } = req.body;

    if (!titre || !type) {
      fs.unlinkSync(req.file.path);
      throw new AppError('Titre et type requis', 400);
    }

    const result = await pool.query(
      `INSERT INTO documents (titre, nom_fichier, chemin, type_mime, taille, type, description, is_confidential, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titre,
        req.file.filename,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        type,
        description || null,
        is_confidential || false,
        req.user.id
      ]
    );

    const document = result.rows[0];

    if (objet_type && objet_id) {
      await pool.query(
        `INSERT INTO documents_liaisons (document_id, objet_type, objet_id)
         VALUES ($1, $2, $3)`,
        [document.id, objet_type, objet_id]
      );
    }

    await logAudit({
      userId: req.user.id,
      action: 'upload',
      tableName: 'documents',
      recordId: document.id,
      newValues: document,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Document uploaded', { 
      documentId: document.id, 
      userId: req.user.id,
      filename: req.file.filename 
    });

    res.status(201).json(document);
  })
);

// Upload multiple fichiers
router.post('/multiple',
  authenticate,
  requirePermission('documents.upload'),
  upload.array('files', 5),
  handleMulterError,
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new AppError('Aucun fichier fourni', 400);
    }

    const { type, objet_type, objet_id } = req.body;
    const documents = [];

    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO documents (titre, nom_fichier, chemin, type_mime, taille, type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          file.originalname,
          file.filename,
          file.path,
          file.mimetype,
          file.size,
          type || 'photo',
          req.user.id
        ]
      );

      const document = result.rows[0];
      documents.push(document);

      // Lier à un objet si spécifié
      if (objet_type && objet_id) {
        await pool.query(
          `INSERT INTO documents_liaisons (document_id, objet_type, objet_id)
           VALUES ($1, $2, $3)`,
          [document.id, objet_type, objet_id]
        );
      }
    }

    logger.info('Multiple documents uploaded', { 
      count: documents.length,
      userId: req.user.id 
    });

    res.status(201).json(documents);
  })
);

// Lister les documents
router.get('/',
  authenticate,
  requirePermission('documents.read'),
  asyncHandler(async (req, res) => {
    const { objet_type, objet_id, type } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, 
             u.prenom || ' ' || u.nom as uploaded_by_nom,
             dl.objet_type, dl.objet_id
      FROM documents d
      LEFT JOIN utilisateurs u ON d.uploaded_by = u.id
      LEFT JOIN documents_liaisons dl ON d.id = dl.document_id
      WHERE d.is_active = true AND (d.is_confidential = false OR d.uploaded_by = $1)
    `;
    const params = [req.user.id];

    if (objet_type && objet_id) {
      params.push(objet_type, objet_id);
      query += ` AND dl.objet_type = $${params.length - 1} AND dl.objet_id = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND d.type = $${params.length}`;
    }

    // Requête COUNT séparée plus simple
    let countQuery = `
      SELECT COUNT(DISTINCT d.id) as count
      FROM documents d
      LEFT JOIN documents_liaisons dl ON d.id = dl.document_id
      WHERE d.is_active = true AND (d.is_confidential = false OR d.uploaded_by = $1)
    `;
    
    const countParams = [req.user.id];
    if (objet_type && objet_id) {
      countParams.push(objet_type, objet_id);
      countQuery += ` AND dl.objet_type = $${countParams.length} AND dl.objet_id = $${countParams.length + 1}`;
    }
    if (type) {
      countParams.push(type);
      countQuery += ` AND d.type = $${countParams.length}`;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || 0);

    params.push(limit, offset);
    query += ` ORDER BY d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// Télécharger un document
router.get('/:id/download',
  authenticate,
  requirePermission('documents.read'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND is_active = true AND (is_confidential = false OR uploaded_by = $2)',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Document non trouvé', 404);
    }

    const document = result.rows[0];

    if (!fs.existsSync(document.chemin)) {
      throw new AppError('Fichier non trouvé sur le serveur', 404);
    }

    res.download(document.chemin, document.nom_fichier);
  })
);

// Supprimer un document
router.delete('/:id',
  authenticate,
  requirePermission('documents.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND (is_confidential = false OR uploaded_by = $2)',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Document non trouvé', 404);
    }

    const document = result.rows[0];

    // Soft delete dans la BDD
    await pool.query(
      'UPDATE documents SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    // Supprimer le fichier physique
    if (fs.existsSync(document.chemin)) {
      fs.unlinkSync(document.chemin);
    }

    // Audit
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'documents',
      recordId: document.id,
      oldValues: document,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info('Document deleted', { documentId: document.id, userId: req.user.id });

    res.json({ message: 'Document supprimé avec succès' });
  })
);

module.exports = router;
