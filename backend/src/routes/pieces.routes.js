const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { logAudit } = require('../config/audit');

// Stock status calculation threshold
// Stock is "attention" when between minimum and (minimum * WARNING_MULTIPLIER)
// This value should match the threshold used in the pieces_avec_alertes view
const STOCK_WARNING_MULTIPLIER = 1.5;

// ==================== PIECES ====================

// Get all pieces with pagination and filters
router.get('/', 
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString(),
    query('fournisseur').optional().isString(),
    query('statut_stock').optional().isIn(['critique', 'attention', 'ok'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;
    const search = req.query.search;
    const fournisseur = req.query.fournisseur;
    const statut_stock = req.query.statut_stock;

    let whereConditions = ['p.is_active = true'];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        p.code ILIKE $${paramIndex} OR 
        p.designation ILIKE $${paramIndex} OR 
        p.reference_fabricant ILIKE $${paramIndex} OR
        p.reference_interne ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (fournisseur) {
      whereConditions.push(`p.fournisseur ILIKE $${paramIndex}`);
      queryParams.push(`%${fournisseur}%`);
      paramIndex++;
    }

    if (statut_stock) {
      if (statut_stock === 'critique') {
        whereConditions.push(`p.quantite_stock <= p.seuil_minimum`);
      } else if (statut_stock === 'attention') {
        whereConditions.push(`p.quantite_stock > p.seuil_minimum AND p.quantite_stock <= (p.seuil_minimum * 1.5)`);
      } else if (statut_stock === 'ok') {
        whereConditions.push(`p.quantite_stock > (p.seuil_minimum * 1.5)`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM pieces p
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get pieces data
    queryParams.push(limit, offset);
    const dataQuery = `
      SELECT 
        p.*,
        CASE 
          WHEN p.quantite_stock <= p.seuil_minimum THEN 'critique'
          WHEN p.quantite_stock <= (p.seuil_minimum * 1.5) THEN 'attention'
          ELSE 'ok'
        END as statut_stock,
        (SELECT COUNT(*) FROM pieces_actifs pa WHERE pa.piece_id = p.id) as nombre_actifs_associes
      FROM pieces p
      ${whereClause}
      ORDER BY p.designation
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const result = await pool.query(dataQuery, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get piece by ID
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        CASE 
          WHEN p.quantite_stock <= p.seuil_minimum THEN 'critique'
          WHEN p.quantite_stock <= (p.seuil_minimum * 1.5) THEN 'attention'
          ELSE 'ok'
        END as statut_stock,
        (SELECT COUNT(*) FROM pieces_actifs pa WHERE pa.piece_id = p.id) as nombre_actifs_associes
      FROM pieces p
      WHERE p.id = $1 AND p.is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Pièce non trouvée', 404);
    }

    res.json(result.rows[0]);
  })
);

// Create new piece
router.post('/',
  authenticate,
  requirePermission('actifs.create'),
  [
    body('code').notEmpty().withMessage('Code requis'),
    body('designation').notEmpty().withMessage('Désignation requise'),
    body('reference_interne').optional().isString(),
    body('reference_fabricant').optional().isString(),
    body('fournisseur').optional().isString(),
    body('site_internet_fournisseur').optional().isURL().withMessage('URL invalide'),
    body('prix_indicatif').optional().isFloat({ min: 0 }).withMessage('Prix doit être positif'),
    body('unite').optional().isString(),
    body('quantite_stock').optional().isInt({ min: 0 }).withMessage('Quantité doit être positive'),
    body('seuil_minimum').optional().isInt({ min: 0 }).withMessage('Seuil doit être positif'),
    body('remarques').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      code,
      designation,
      reference_interne,
      reference_fabricant,
      fournisseur,
      site_internet_fournisseur,
      prix_indicatif,
      prix_unitaire, // Compatibility with old field
      unite,
      quantite_stock,
      stock_actuel, // Compatibility with old field
      seuil_minimum,
      stock_min, // Compatibility with old field
      remarques
    } = req.body;

    // Use new fields, fallback to old fields for compatibility
    const finalQuantiteStock = quantite_stock !== undefined ? quantite_stock : (stock_actuel || 0);
    const finalSeuilMinimum = seuil_minimum !== undefined ? seuil_minimum : (stock_min || 0);
    const finalPrix = prix_indicatif !== undefined ? prix_indicatif : (prix_unitaire || null);

    // Insert with both new and old field names for backward compatibility
    // New fields: quantite_stock, seuil_minimum, prix_indicatif
    // Old fields (same values): stock_actuel, stock_min, prix_unitaire
    const result = await pool.query(
      `INSERT INTO pieces (
        code, designation, reference_interne, reference_fabricant, 
        fournisseur, site_internet_fournisseur, unite, remarques,
        prix_indicatif, prix_unitaire,
        quantite_stock, stock_actuel, 
        seuil_minimum, stock_min
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $10, $11, $11)
      RETURNING *`,
      [
        code,
        designation,
        reference_interne || null,
        reference_fabricant || null,
        fournisseur || null,
        site_internet_fournisseur || null,
        unite || null,
        remarques || null,
        finalPrix,
        finalQuantiteStock,
        finalSeuilMinimum
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'pieces',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Update piece
router.patch('/:id',
  authenticate,
  requirePermission('actifs.update'),
  [
    body('code').optional().notEmpty(),
    body('designation').optional().notEmpty(),
    body('reference_interne').optional().isString(),
    body('reference_fabricant').optional().isString(),
    body('fournisseur').optional().isString(),
    body('site_internet_fournisseur').optional().isURL().withMessage('URL invalide'),
    body('prix_indicatif').optional().isFloat({ min: 0 }),
    body('unite').optional().isString(),
    body('quantite_stock').optional().isInt({ min: 0 }),
    body('seuil_minimum').optional().isInt({ min: 0 }),
    body('remarques').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get old values for audit
    const oldResult = await pool.query(
      'SELECT * FROM pieces WHERE id = $1 AND is_active = true',
      [req.params.id]
    );

    if (oldResult.rows.length === 0) {
      throw new AppError('Pièce non trouvée', 404);
    }

    const allowedFields = [
      'code', 'designation', 'reference_interne', 'reference_fabricant',
      'fournisseur', 'site_internet_fournisseur', 'prix_indicatif', 
      'unite', 'quantite_stock', 'seuil_minimum', 'remarques'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
        
        // Also update legacy fields for compatibility
        if (field === 'quantite_stock') {
          updates.push(`stock_actuel = $${paramIndex - 1}`);
        }
        if (field === 'seuil_minimum') {
          updates.push(`stock_min = $${paramIndex - 1}`);
        }
        if (field === 'prix_indicatif') {
          updates.push(`prix_unitaire = $${paramIndex - 1}`);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const query = `
      UPDATE pieces
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      tableName: 'pieces',
      recordId: req.params.id,
      oldValues: oldResult.rows[0],
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(result.rows[0]);
  })
);

// Delete piece (soft delete)
router.delete('/:id',
  authenticate,
  requirePermission('actifs.delete'),
  asyncHandler(async (req, res) => {
    const oldResult = await pool.query(
      'SELECT * FROM pieces WHERE id = $1 AND is_active = true',
      [req.params.id]
    );

    if (oldResult.rows.length === 0) {
      throw new AppError('Pièce non trouvée', 404);
    }

    await pool.query(
      'UPDATE pieces SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'pieces',
      recordId: req.params.id,
      oldValues: oldResult.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Pièce supprimée avec succès' });
  })
);

// ==================== ASSOCIATIONS PIECES-ACTIFS ====================

// Get actifs associated with a piece
router.get('/:id/actifs',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT 
        a.*,
        pa.quantite_necessaire,
        pa.remarques as association_remarques,
        pa.created_at as date_association,
        at.nom as type_nom,
        s.nom as site_nom
      FROM pieces_actifs pa
      JOIN actifs a ON pa.actif_id = a.id
      LEFT JOIN actifs_types at ON a.type_id = at.id
      LEFT JOIN sites s ON a.site_id = s.id
      WHERE pa.piece_id = $1 AND a.is_active = true
      ORDER BY a.code_interne`,
      [req.params.id]
    );

    res.json({ data: result.rows });
  })
);

// Associate piece with actif
router.post('/:id/actifs',
  authenticate,
  requirePermission('actifs.update'),
  [
    body('actif_id').isUUID().withMessage('ID actif invalide'),
    body('quantite_necessaire').optional().isInt({ min: 1 }).withMessage('Quantité doit être positive'),
    body('remarques').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { actif_id, quantite_necessaire, remarques } = req.body;

    // Check if piece exists
    const pieceCheck = await pool.query(
      'SELECT id FROM pieces WHERE id = $1 AND is_active = true',
      [req.params.id]
    );
    if (pieceCheck.rows.length === 0) {
      throw new AppError('Pièce non trouvée', 404);
    }

    // Check if actif exists
    const actifCheck = await pool.query(
      'SELECT id FROM actifs WHERE id = $1 AND is_active = true',
      [actif_id]
    );
    if (actifCheck.rows.length === 0) {
      throw new AppError('Actif non trouvé', 404);
    }

    // Check if association already exists
    const existingCheck = await pool.query(
      'SELECT id FROM pieces_actifs WHERE piece_id = $1 AND actif_id = $2',
      [req.params.id, actif_id]
    );

    let result;
    if (existingCheck.rows.length > 0) {
      // Update existing association
      result = await pool.query(
        `UPDATE pieces_actifs 
         SET quantite_necessaire = $1, remarques = $2
         WHERE piece_id = $3 AND actif_id = $4
         RETURNING *`,
        [quantite_necessaire || 1, remarques || null, req.params.id, actif_id]
      );
    } else {
      // Create new association
      result = await pool.query(
        `INSERT INTO pieces_actifs (piece_id, actif_id, quantite_necessaire, remarques, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.params.id, actif_id, quantite_necessaire || 1, remarques || null, req.user.id]
      );
    }

    await logAudit({
      userId: req.user.id,
      action: existingCheck.rows.length > 0 ? 'update' : 'create',
      tableName: 'pieces_actifs',
      recordId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json(result.rows[0]);
  })
);

// Remove piece-actif association
router.delete('/:pieceId/actifs/:actifId',
  authenticate,
  requirePermission('actifs.update'),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'DELETE FROM pieces_actifs WHERE piece_id = $1 AND actif_id = $2 RETURNING *',
      [req.params.pieceId, req.params.actifId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Association non trouvée', 404);
    }

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'pieces_actifs',
      recordId: result.rows[0].id,
      oldValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Association supprimée avec succès' });
  })
);

// Get pieces for a specific actif
router.get('/actif/:actifId',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT 
        p.*,
        pa.quantite_necessaire,
        pa.remarques as association_remarques,
        CASE 
          WHEN p.quantite_stock <= p.seuil_minimum THEN 'critique'
          WHEN p.quantite_stock <= (p.seuil_minimum * 1.5) THEN 'attention'
          ELSE 'ok'
        END as statut_stock
      FROM pieces_actifs pa
      JOIN pieces p ON pa.piece_id = p.id
      WHERE pa.actif_id = $1 AND p.is_active = true
      ORDER BY p.designation`,
      [req.params.actifId]
    );

    res.json({ data: result.rows });
  })
);

module.exports = router;
