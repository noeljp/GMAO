const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { logAudit } = require('../config/audit');

// ==================== TYPES D'ACTIFS ====================

// Get actifs types
router.get('/types', 
  authenticate, 
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM actifs_types WHERE is_active = true ORDER BY nom');
    res.json({ data: result.rows });
  })
);

// ==================== CHAMPS PERSONNALISÉS ====================

// Get champs personnalisés pour un type d'actif
router.get('/types/:typeId/champs',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT * FROM actifs_champs_definition 
       WHERE type_actif_id = $1 AND is_active = true 
       ORDER BY ordre, libelle`,
      [req.params.typeId]
    );
    res.json({ data: result.rows });
  })
);

// Créer un champ personnalisé pour un type
router.post('/types/:typeId/champs',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('nom').notEmpty().withMessage('Nom requis'),
    body('libelle').notEmpty().withMessage('Libellé requis'),
    body('type_champ').isIn(['text', 'number', 'date', 'boolean', 'select', 'textarea'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nom, libelle, type_champ, unite, valeurs_possibles, ordre, obligatoire, description } = req.body;

    const result = await pool.query(
      `INSERT INTO actifs_champs_definition 
       (type_actif_id, nom, libelle, type_champ, unite, valeurs_possibles, ordre, obligatoire, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.params.typeId,
        nom,
        libelle,
        type_champ,
        unite || null,
        valeurs_possibles || null,
        ordre || 0,
        obligatoire || false,
        description || null
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'actifs_champs_definition',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// ==================== HIÉRARCHIE D'ACTIFS ====================

// Get enfants d'un actif
router.get('/:id/enfants',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT a.*, 
              at.nom as type_nom,
              ast.nom as statut_nom
       FROM actifs a
       LEFT JOIN actifs_types at ON a.type_id = at.id
       LEFT JOIN actifs_statuts ast ON a.statut_id = ast.id
       WHERE a.parent_id = $1 AND a.is_active = true AND (a.is_confidential = false OR a.created_by = $2)
       ORDER BY a.niveau, a.code_interne`,
      [req.params.id, req.user.id]
    );
    res.json({ data: result.rows });
  })
);

// Get hiérarchie complète (arbre) depuis un actif
router.get('/:id/hierarchie',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `WITH RECURSIVE actif_tree AS (
         SELECT a.*, 0 as depth
         FROM actifs a
         WHERE a.id = $1
         
         UNION ALL
         
         SELECT a.*, at.depth + 1
         FROM actifs a
         INNER JOIN actif_tree at ON a.parent_id = at.id
         WHERE a.is_active = true
       )
       SELECT at.*, 
              aty.nom as type_nom,
              ast.nom as statut_nom
       FROM actif_tree at
       LEFT JOIN actifs_types aty ON at.type_id = aty.id
       LEFT JOIN actifs_statuts ast ON at.statut_id = ast.id
       ORDER BY at.depth, at.code_interne`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  })
);

// Get parents (chemin depuis la racine)
router.get('/:id/parents',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `WITH RECURSIVE actif_parents AS (
         SELECT a.*, 0 as depth
         FROM actifs a
         WHERE a.id = $1
         
         UNION ALL
         
         SELECT a.*, ap.depth + 1
         FROM actifs a
         INNER JOIN actif_parents ap ON a.id = ap.parent_id
       )
       SELECT * FROM actif_parents
       ORDER BY depth DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  })
);

// ==================== ACTIFS CRUD ====================

// Get all actifs with filters
router.get('/', 
  authenticate, 
  asyncHandler(async (req, res) => {
    const { site_id, type_id, statut_id, parent_id, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) FROM actifs a WHERE a.is_active = true AND (a.is_confidential = false OR a.created_by = $1)';
    let query = `
      SELECT a.*, 
             s.nom as site_nom,
             at.nom as type_nom,
             ast.nom as statut_nom,
             ac.nom as criticite_nom,
             af.nom as fabricant_nom,
             parent.code_interne as parent_code,
             (SELECT COUNT(*) FROM actifs WHERE parent_id = a.id AND is_active = true) as enfants_count
      FROM actifs a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN actifs_types at ON a.type_id = at.id
      LEFT JOIN actifs_statuts ast ON a.statut_id = ast.id
      LEFT JOIN actifs_criticites ac ON a.criticite_id = ac.id
      LEFT JOIN actifs_fabricants af ON a.fabricant_id = af.id
      LEFT JOIN actifs parent ON a.parent_id = parent.id
      WHERE a.is_active = true AND (a.is_confidential = false OR a.created_by = $1)
    `;
    const params = [req.user.id];
    
    if (site_id) {
      params.push(site_id);
      query += ` AND a.site_id = $${params.length}`;
      countQuery += ` AND a.site_id = $${params.length}`;
    }
    if (type_id) {
      params.push(type_id);
      query += ` AND a.type_id = $${params.length}`;
      countQuery += ` AND a.type_id = $${params.length}`;
    }
    if (statut_id) {
      params.push(statut_id);
      query += ` AND a.statut_id = $${params.length}`;
      countQuery += ` AND a.statut_id = $${params.length}`;
    }
    if (parent_id) {
      params.push(parent_id);
      query += ` AND a.parent_id = $${params.length}`;
      countQuery += ` AND a.parent_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.code_interne ILIKE $${params.length} OR a.description ILIKE $${params.length})`;
      countQuery += ` AND (a.code_interne ILIKE $${params.length} OR a.description ILIKE $${params.length})`;
    }

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    query += ' ORDER BY a.niveau, a.chemin_hierarchique, a.code_interne LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
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

// Get actif by ID avec champs personnalisés
router.get('/:id', 
  authenticate, 
  asyncHandler(async (req, res) => {
    const actifResult = await pool.query(`
      SELECT a.*, 
             s.nom as site_nom,
             l.nom as localisation_nom,
             at.nom as type_nom,
             ast.nom as statut_nom,
             ac.nom as criticite_nom,
             af.nom as fabricant_nom,
             parent.code_interne as parent_code,
             parent.id as parent_id_full
      FROM actifs a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN localisations l ON a.localisation_id = l.id
      LEFT JOIN actifs_types at ON a.type_id = at.id
      LEFT JOIN actifs_statuts ast ON a.statut_id = ast.id
      LEFT JOIN actifs_criticites ac ON a.criticite_id = ac.id
      LEFT JOIN actifs_fabricants af ON a.fabricant_id = af.id
      LEFT JOIN actifs parent ON a.parent_id = parent.id
      WHERE a.id = $1 AND (a.is_confidential = false OR a.created_by = $2)
    `, [req.params.id, req.user.id]);
    
    if (actifResult.rows.length === 0) {
      throw new AppError('Actif non trouvé', 404);
    }

    const actif = actifResult.rows[0];

    // Récupérer les champs personnalisés
    const champsResult = await pool.query(`
      SELECT 
        acd.id as definition_id,
        acd.nom,
        acd.libelle,
        acd.type_champ,
        acd.unite,
        acd.valeurs_possibles,
        acv.valeur_text,
        acv.valeur_number,
        acv.valeur_date,
        acv.valeur_boolean,
        acv.valeur_json
      FROM actifs_champs_definition acd
      LEFT JOIN actifs_champs_valeurs acv ON acd.id = acv.champ_definition_id AND acv.actif_id = $1
      WHERE acd.type_actif_id = $2 AND acd.is_active = true
      ORDER BY acd.ordre, acd.libelle
    `, [req.params.id, actif.type_id]);

    actif.champs_personnalises = champsResult.rows;

    res.json(actif);
  })
);

// Create actif
router.post('/', 
  authenticate,
  requirePermission('actifs.create'),
  [
    body('code_interne').notEmpty().withMessage('Code interne requis'),
    body('site_id').isUUID().withMessage('Site ID invalide'),
    body('type_id').isUUID().withMessage('Type ID invalide')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      code_interne, numero_serie, description, site_id, localisation_id,
      type_id, fabricant_id, statut_id, criticite_id, date_mise_en_service,
      parent_id, champs_personnalises, is_confidential
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO actifs 
         (code_interne, numero_serie, description, site_id, localisation_id, type_id, 
          fabricant_id, statut_id, criticite_id, date_mise_en_service, parent_id, is_confidential, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING *`,
        [
          code_interne, numero_serie || null, description || null, site_id,
          localisation_id || null, type_id, fabricant_id || null, statut_id || null,
          criticite_id || null, date_mise_en_service || null, parent_id || null, 
          is_confidential || false, req.user.id
        ]
      );

      const actif = result.rows[0];

      if (champs_personnalises && Array.isArray(champs_personnalises)) {
        for (const champ of champs_personnalises) {
          await client.query(
            `INSERT INTO actifs_champs_valeurs 
             (actif_id, champ_definition_id, valeur_text, valeur_number, valeur_date, valeur_boolean, valeur_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (actif_id, champ_definition_id) 
             DO UPDATE SET 
               valeur_text = EXCLUDED.valeur_text,
               valeur_number = EXCLUDED.valeur_number,
               valeur_date = EXCLUDED.valeur_date,
               valeur_boolean = EXCLUDED.valeur_boolean,
               valeur_json = EXCLUDED.valeur_json,
               updated_at = NOW()`,
            [
              actif.id,
              champ.definition_id,
              champ.valeur_text || null,
              champ.valeur_number || null,
              champ.valeur_date || null,
              champ.valeur_boolean || null,
              champ.valeur_json || null
            ]
          );
        }
      }

      await client.query('COMMIT');

      await logAudit({
        userId: req.user.id,
        action: 'create',
        tableName: 'actifs',
        recordId: actif.id,
        newValues: actif,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(201).json(actif);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// Update actif
router.patch('/:id', 
  authenticate,
  requirePermission('actifs.edit'),
  asyncHandler(async (req, res) => {
    const actifId = req.params.id;
    const {
      code_interne, numero_serie, description, site_id, localisation_id,
      type_id, fabricant_id, statut_id, criticite_id, date_mise_en_service,
      parent_id, champs_personnalises, is_confidential
    } = req.body;

    const checkResult = await pool.query('SELECT * FROM actifs WHERE id = $1 AND (is_confidential = false OR created_by = $2)', [actifId, req.user.id]);
    if (checkResult.rows.length === 0) {
      throw new AppError('Actif non trouvé', 404);
    }

    const oldValues = checkResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE actifs SET
          code_interne = COALESCE($1, code_interne),
          numero_serie = COALESCE($2, numero_serie),
          description = COALESCE($3, description),
          site_id = COALESCE($4, site_id),
          localisation_id = COALESCE($5, localisation_id),
          type_id = COALESCE($6, type_id),
          fabricant_id = COALESCE($7, fabricant_id),
          statut_id = COALESCE($8, statut_id),
          criticite_id = COALESCE($9, criticite_id),
          date_mise_en_service = COALESCE($10, date_mise_en_service),
          parent_id = COALESCE($11, parent_id),
          is_confidential = COALESCE($12, is_confidential),
          updated_by = $13,
          updated_at = NOW()
         WHERE id = $14
         RETURNING *`,
        [
          code_interne, numero_serie, description, site_id, localisation_id,
          type_id, fabricant_id, statut_id, criticite_id, date_mise_en_service,
          parent_id, is_confidential, req.user.id, actifId
        ]
      );

      const updatedActif = result.rows[0];

      if (champs_personnalises && Array.isArray(champs_personnalises)) {
        for (const champ of champs_personnalises) {
          await client.query(
            `INSERT INTO actifs_champs_valeurs 
             (actif_id, champ_definition_id, valeur_text, valeur_number, valeur_date, valeur_boolean, valeur_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (actif_id, champ_definition_id) 
             DO UPDATE SET 
               valeur_text = EXCLUDED.valeur_text,
               valeur_number = EXCLUDED.valeur_number,
               valeur_date = EXCLUDED.valeur_date,
               valeur_boolean = EXCLUDED.valeur_boolean,
               valeur_json = EXCLUDED.valeur_json,
               updated_at = NOW()`,
            [
              actifId,
              champ.definition_id,
              champ.valeur_text || null,
              champ.valeur_number || null,
              champ.valeur_date || null,
              champ.valeur_boolean || null,
              champ.valeur_json || null
            ]
          );
        }
      }

      await client.query('COMMIT');

      await logAudit({
        userId: req.user.id,
        action: 'update',
        tableName: 'actifs',
        recordId: actifId,
        oldValues,
        newValues: updatedActif,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json(updatedActif);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

// Delete actif (soft delete)
router.delete('/:id', 
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'UPDATE actifs SET is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2 AND (is_confidential = false OR created_by = $1) RETURNING *',
      [req.user.id, req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Actif non trouvé', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'actifs',
      recordId: req.params.id,
      oldValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Actif supprimé avec succès' });
  })
);

module.exports = router;
