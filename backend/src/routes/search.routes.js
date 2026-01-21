const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

// Recherche globale multi-entités
router.get('/', 
  authenticate,
  [
    query('q').notEmpty().withMessage('Le terme de recherche est requis'),
    query('entities').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation échouée', 400, errors.array());
    }

    const searchTerm = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    const entities = req.query.entities ? req.query.entities.split(',') : ['actifs', 'ordres_travail', 'demandes'];
    
    const results = {};

    // Recherche dans les actifs
    if (entities.includes('actifs')) {
      const actifs = await pool.query(
        `SELECT id, nom, code, type, statut, site_id,
                ts_rank(
                  to_tsvector('french', nom || ' ' || COALESCE(description, '') || ' ' || COALESCE(code, '')),
                  plainto_tsquery('french', $1)
                ) as rank
         FROM actifs
         WHERE is_active = true
           AND (
             to_tsvector('french', nom || ' ' || COALESCE(description, '') || ' ' || COALESCE(code, '')) 
             @@ plainto_tsquery('french', $1)
             OR nom ILIKE $2
             OR code ILIKE $2
           )
         ORDER BY rank DESC, nom
         LIMIT $3`,
        [searchTerm, `%${searchTerm}%`, limit]
      );
      results.actifs = actifs.rows;
    }

    // Recherche dans les ordres de travail
    if (entities.includes('ordres_travail')) {
      const ot = await pool.query(
        `SELECT ot.id, ot.titre, ot.numero, ot.description, ot.statut, ot.priorite,
                a.nom as actif_nom,
                ts_rank(
                  to_tsvector('french', ot.titre || ' ' || COALESCE(ot.description, '') || ' ' || COALESCE(ot.numero, '')),
                  plainto_tsquery('french', $1)
                ) as rank
         FROM ordres_travail ot
         LEFT JOIN actifs a ON ot.actif_id = a.id
         WHERE (
           to_tsvector('french', ot.titre || ' ' || COALESCE(ot.description, '') || ' ' || COALESCE(ot.numero, '')) 
           @@ plainto_tsquery('french', $1)
           OR ot.titre ILIKE $2
           OR ot.numero ILIKE $2
         )
         ORDER BY rank DESC, ot.created_at DESC
         LIMIT $3`,
        [searchTerm, `%${searchTerm}%`, limit]
      );
      results.ordres_travail = ot.rows;
    }

    // Recherche dans les demandes
    if (entities.includes('demandes')) {
      const demandes = await pool.query(
        `SELECT d.id, d.titre, d.description, d.statut, d.priorite, d.type,
                a.nom as actif_nom,
                ts_rank(
                  to_tsvector('french', d.titre || ' ' || COALESCE(d.description, '')),
                  plainto_tsquery('french', $1)
                ) as rank
         FROM demandes_intervention d
         LEFT JOIN actifs a ON d.actif_id = a.id
         WHERE (
           to_tsvector('french', d.titre || ' ' || COALESCE(d.description, '')) 
           @@ plainto_tsquery('french', $1)
           OR d.titre ILIKE $2
         )
         ORDER BY rank DESC, d.created_at DESC
         LIMIT $3`,
        [searchTerm, `%${searchTerm}%`, limit]
      );
      results.demandes = demandes.rows;
    }

    // Recherche dans les sites
    if (entities.includes('sites')) {
      const sites = await pool.query(
        `SELECT id, nom, code, ville, pays
         FROM sites
         WHERE is_active = true
           AND (
             nom ILIKE $1 
             OR code ILIKE $1 
             OR ville ILIKE $1
           )
         ORDER BY nom
         LIMIT $2`,
        [`%${searchTerm}%`, limit]
      );
      results.sites = sites.rows;
    }

    // Calculer le total des résultats
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    res.json({
      query: searchTerm,
      total: totalResults,
      results
    });
  })
);

// Recherche avancée dans les actifs avec filtres
router.get('/actifs', 
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const { q, type, statut, site_id, date_debut, date_fin } = req.query;

    let whereConditions = ['is_active = true'];
    let queryParams = [];
    let paramIndex = 1;

    // Recherche textuelle
    if (q) {
      whereConditions.push(
        `(to_tsvector('french', nom || ' ' || COALESCE(description, '') || ' ' || COALESCE(code, '')) 
          @@ plainto_tsquery('french', $${paramIndex})
          OR nom ILIKE $${paramIndex + 1}
          OR code ILIKE $${paramIndex + 1})`
      );
      queryParams.push(q, `%${q}%`);
      paramIndex += 2;
    }

    // Filtres additionnels
    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (statut) {
      whereConditions.push(`statut = $${paramIndex}`);
      queryParams.push(statut);
      paramIndex++;
    }

    if (site_id) {
      whereConditions.push(`site_id = $${paramIndex}`);
      queryParams.push(site_id);
      paramIndex++;
    }

    if (date_debut) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(date_debut);
      paramIndex++;
    }

    if (date_fin) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(date_fin);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Requête avec pagination
    const result = await pool.query(
      `SELECT a.*, s.nom as site_nom
       FROM actifs a
       LEFT JOIN sites s ON a.site_id = s.id
       WHERE ${whereClause}
       ORDER BY ${q ? `ts_rank(
         to_tsvector('french', a.nom || ' ' || COALESCE(a.description, '') || ' ' || COALESCE(a.code, '')),
         plainto_tsquery('french', $1)
       ) DESC,` : ''} a.nom
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Compter le total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM actifs WHERE ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].count);

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

// Recherche avancée dans les ordres de travail
router.get('/ordres-travail', 
  authenticate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const { q, statut, priorite, type, actif_id, technicien_id, date_debut, date_fin } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Recherche textuelle
    if (q) {
      whereConditions.push(
        `(to_tsvector('french', ot.titre || ' ' || COALESCE(ot.description, '') || ' ' || COALESCE(ot.numero, '')) 
          @@ plainto_tsquery('french', $${paramIndex})
          OR ot.titre ILIKE $${paramIndex + 1}
          OR ot.numero ILIKE $${paramIndex + 1})`
      );
      queryParams.push(q, `%${q}%`);
      paramIndex += 2;
    }

    // Filtres
    if (statut) {
      whereConditions.push(`ot.statut = $${paramIndex}`);
      queryParams.push(statut);
      paramIndex++;
    }

    if (priorite) {
      whereConditions.push(`ot.priorite = $${paramIndex}`);
      queryParams.push(priorite);
      paramIndex++;
    }

    if (type) {
      whereConditions.push(`ot.type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (actif_id) {
      whereConditions.push(`ot.actif_id = $${paramIndex}`);
      queryParams.push(actif_id);
      paramIndex++;
    }

    if (technicien_id) {
      whereConditions.push(`ot.technicien_id = $${paramIndex}`);
      queryParams.push(technicien_id);
      paramIndex++;
    }

    if (date_debut) {
      whereConditions.push(`ot.date_debut >= $${paramIndex}`);
      queryParams.push(date_debut);
      paramIndex++;
    }

    if (date_fin) {
      whereConditions.push(`ot.date_fin <= $${paramIndex}`);
      queryParams.push(date_fin);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT ot.*, 
              a.nom as actif_nom,
              u.nom as technicien_nom
       FROM ordres_travail ot
       LEFT JOIN actifs a ON ot.actif_id = a.id
       LEFT JOIN utilisateurs u ON ot.technicien_id = u.id
       ${whereClause}
       ORDER BY ${q ? `ts_rank(
         to_tsvector('french', ot.titre || ' ' || COALESCE(ot.description, '') || ' ' || COALESCE(ot.numero, '')),
         plainto_tsquery('french', $1)
       ) DESC,` : ''} ot.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ordres_travail ot ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].count);

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

module.exports = router;
