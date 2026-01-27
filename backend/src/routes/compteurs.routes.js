const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../config/permissions');
const pool = require('../config/database');
const { logAudit } = require('../config/audit');
const logger = require('../config/logger');
const mqttService = require('../config/mqtt');

// =====================================================
// SAISIE MANUELLE DES COMPTEURS
// =====================================================

/**
 * @route GET /api/compteurs/actif/:actifId
 * @desc Obtenir les compteurs d'un actif avec leurs valeurs actuelles
 */
router.get('/actif/:actifId', authenticate, async (req, res) => {
  try {
    const { actifId } = req.params;

    // Récupérer les champs de type number pour cet actif
    const result = await pool.query(
      `SELECT 
        acd.id as champ_id,
        acd.nom,
        acd.libelle,
        acd.unite,
        acd.description,
        acv.valeur_number as valeur_actuelle,
        acv.updated_at as derniere_mise_a_jour
        
      FROM actifs_champs_definition acd
      JOIN actifs a ON a.type_id = acd.type_actif_id
      LEFT JOIN actifs_champs_valeurs acv ON acv.actif_id = a.id AND acv.champ_definition_id = acd.id
      WHERE a.id = $1 
        AND acd.type_champ = 'number'
        AND acd.is_active = true
      ORDER BY acd.ordre, acd.libelle`,
      [actifId]
    );

    // Récupérer les seuils pour chaque compteur
    const seuilsResult = await pool.query(
      `SELECT 
        asa.id,
        asa.champ_definition_id,
        asa.type_seuil,
        asa.valeur_seuil_min,
        asa.valeur_seuil_max,
        asa.niveau_alerte,
        asa.message_alerte,
        asa.action_automatique,
        asa.template_maintenance_id,
        asa.actif,
        tm.nom as template_nom,
        tm.type_maintenance as template_type
      FROM actifs_seuils_alertes asa
      LEFT JOIN templates_maintenance tm ON tm.id = asa.template_maintenance_id
      WHERE asa.actif_id = $1 AND asa.actif = true
      ORDER BY asa.valeur_seuil_min`,
      [actifId]
    );

    // Grouper les seuils par champ_definition_id
    const seuilsByChamp = {};
    seuilsResult.rows.forEach(seuil => {
      const champId = seuil.champ_definition_id;
      if (!seuilsByChamp[champId]) {
        seuilsByChamp[champId] = [];
      }
      seuilsByChamp[champId].push(seuil);
    });

    // Ajouter les seuils à chaque compteur
    const compteursWithSeuils = result.rows.map(compteur => ({
      ...compteur,
      seuils: seuilsByChamp[compteur.champ_id] || []
    }));

    res.json({
      success: true,
      data: compteursWithSeuils
    });

  } catch (error) {
    logger.error('Error getting compteurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des compteurs' });
  }
});

/**
 * @route POST /api/compteurs/actif/:actifId/saisie
 * @desc Saisir manuellement la valeur d'un compteur
 */
router.post('/actif/:actifId/saisie', authenticate, async (req, res) => {
  try {
    const { actifId } = req.params;
    const { champ_id, valeur, commentaire } = req.body;

    // Vérifier que l'actif existe
    const actifResult = await pool.query(
      'SELECT id, code_interne FROM actifs WHERE id = $1',
      [actifId]
    );

    if (actifResult.rows.length === 0) {
      return res.status(404).json({ error: 'Actif non trouvé' });
    }

    // Vérifier que le champ existe et est de type number
    const champResult = await pool.query(
      'SELECT id, type_champ, libelle FROM actifs_champs_definition WHERE id = $1',
      [champ_id]
    );

    if (champResult.rows.length === 0) {
      return res.status(404).json({ error: 'Champ non trouvé' });
    }

    if (champResult.rows[0].type_champ !== 'number') {
      return res.status(400).json({ error: 'Ce champ n\'est pas un compteur' });
    }

    // Insérer ou mettre à jour la valeur
    await pool.query(
      `INSERT INTO actifs_champs_valeurs (actif_id, champ_definition_id, valeur_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (actif_id, champ_definition_id)
       DO UPDATE SET valeur_number = EXCLUDED.valeur_number, updated_at = NOW()`,
      [actifId, champ_id, valeur]
    );

    // Vérifier les seuils d'alerte et créer OT si nécessaire
    const seuilsResult = await pool.query(
      `SELECT 
        asa.id,
        asa.type_seuil,
        asa.valeur_seuil_min,
        asa.valeur_seuil_max,
        asa.niveau_alerte,
        asa.message_alerte,
        asa.action_automatique,
        asa.template_maintenance_id,
        tm.nom as template_nom,
        tm.description as template_description,
        tm.type_maintenance,
        tm.priorite as template_priorite,
        tm.duree_estimee_heures,
        tm.instructions,
        acd.libelle as compteur_nom
      FROM actifs_seuils_alertes asa
      LEFT JOIN templates_maintenance tm ON tm.id = asa.template_maintenance_id
      LEFT JOIN actifs_champs_definition acd ON acd.id = asa.champ_definition_id
      WHERE asa.actif_id = $1 
        AND asa.champ_definition_id = $2 
        AND asa.actif = true`,
      [actifId, champ_id]
    );

    const alertesCreees = [];
    const valeurNum = parseFloat(valeur);

    for (const seuil of seuilsResult.rows) {
      let seuilDepasse = false;

      // Vérifier si le seuil est dépassé
      switch (seuil.type_seuil) {
        case 'superieur':
          seuilDepasse = valeurNum > parseFloat(seuil.valeur_seuil_min);
          break;
        case 'inferieur':
          seuilDepasse = valeurNum < parseFloat(seuil.valeur_seuil_min);
          break;
        case 'egal':
          seuilDepasse = valeurNum === parseFloat(seuil.valeur_seuil_min);
          break;
        case 'entre':
          seuilDepasse = valeurNum >= parseFloat(seuil.valeur_seuil_min) && 
                         valeurNum <= parseFloat(seuil.valeur_seuil_max);
          break;
      }

      // Si le seuil est dépassé et qu'une action automatique est configurée
      if (seuilDepasse && seuil.action_automatique && seuil.action_automatique.includes('ordre')) {
        try {
          // Créer automatiquement un OT
          const titre = seuil.template_nom 
            ? `[AUTO] ${seuil.template_nom} - ${seuil.compteur_nom}`
            : `[AUTO] Alerte ${seuil.niveau_alerte} - ${seuil.compteur_nom}`;

          const description = seuil.template_description || 
            `Alerte automatique: ${seuil.message_alerte || 'Seuil dépassé'}\n` +
            `Compteur: ${seuil.compteur_nom}\n` +
            `Valeur: ${valeurNum}\n` +
            `Seuil: ${seuil.type_seuil} ${seuil.valeur_seuil_min}` +
            (seuil.valeur_seuil_max ? ` - ${seuil.valeur_seuil_max}` : '');

          const instructions = seuil.instructions || description;

          // Mapper la priorité du template ou du seuil
          let priorite = 'normale';
          if (seuil.template_priorite) {
            priorite = seuil.template_priorite;
          } else if (seuil.niveau_alerte === 'critical') {
            priorite = 'critique';
          } else if (seuil.niveau_alerte === 'warning') {
            priorite = 'haute';
          }

          // Mapper le type de maintenance
          const type = seuil.type_maintenance || 'correctif';

          const otResult = await pool.query(
            `INSERT INTO ordres_travail (
              titre, description, actif_id, type, priorite,
              duree_estimee, statut, created_by, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'en_attente', $7, NOW(), NOW())
            RETURNING id, titre`,
            [
              titre,
              instructions,
              actifId,
              type,
              priorite,
              seuil.duree_estimee_heures || 2,
              req.user.id
            ]
          );

          alertesCreees.push({
            seuil_id: seuil.id,
            niveau: seuil.niveau_alerte,
            message: seuil.message_alerte,
            ordre_travail_id: otResult.rows[0].id,
            ordre_travail_titre: otResult.rows[0].titre
          });

        } catch (otError) {
          logger.error('Error creating automatic OT:', otError);
          // Continue même si la création d'OT échoue
        }
      }
    }

    // Log d'audit (désactivé temporairement - colonne action NOT NULL)
    // await logAudit(
    //   req.user.id,
    //   'UPDATE',
    //   'actifs_champs_valeurs',
    //   actifId,
    //   null,
    //   { champ_id, valeur, commentaire },
    //   `Saisie manuelle du compteur ${champResult.rows[0].libelle}: ${valeur}`
    // );

    res.json({
      success: true,
      message: 'Compteur mis à jour avec succès',
      alertes_declenchees: alertesCreees
    });

  } catch (error) {
    logger.error('Error saving compteur:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde du compteur' });
  }
});

// =====================================================
// GESTION DES SEUILS D'ALERTE
// =====================================================

/**
 * @route GET /api/compteurs/seuils/actif/:actifId
 * @desc Obtenir tous les seuils d'un actif
 */
router.get('/seuils/actif/:actifId', authenticate, async (req, res) => {
  try {
    const { actifId } = req.params;

    const result = await pool.query(
      `SELECT 
        asa.*,
        acd.libelle as champ_libelle,
        acd.unite as champ_unite,
        tmp.nom as template_nom
      FROM actifs_seuils_alertes asa
      LEFT JOIN actifs_champs_definition acd ON asa.champ_definition_id = acd.id
      LEFT JOIN templates_maintenance_preventive tmp ON asa.template_maintenance_id = tmp.id
      WHERE asa.actif_id = $1
      ORDER BY asa.created_at DESC`,
      [actifId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error getting seuils:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des seuils' });
  }
});

/**
 * @route POST /api/compteurs/seuils
 * @desc Créer un nouveau seuil d'alerte
 */
router.post('/seuils', authenticate, async (req, res) => {
  try {
    const {
      actif_id,
      champ_definition_id,
      champ_standard,
      type_seuil,
      valeur_seuil_min,
      valeur_seuil_max,
      niveau_alerte,
      message_alerte,
      action_automatique,
      template_maintenance_id
    } = req.body;

    const result = await pool.query(
      `INSERT INTO actifs_seuils_alertes 
       (actif_id, champ_definition_id, champ_standard, type_seuil, 
        valeur_seuil_min, valeur_seuil_max, niveau_alerte, message_alerte,
        action_automatique, template_maintenance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        actif_id,
        champ_definition_id || null,
        champ_standard || null,
        type_seuil,
        valeur_seuil_min,
        valeur_seuil_max || null,
        niveau_alerte,
        message_alerte,
        action_automatique || null,
        template_maintenance_id || null
      ]
    );

    // Log d'audit (désactivé temporairement - colonne action NOT NULL)
    // await logAudit(
    //   req.user.id,
    //   'CREATE',
    //   'actifs_seuils_alertes',
    //   result.rows[0].id,
    //   null,
    //   result.rows[0],
    //   'Création d\'un seuil d\'alerte'
    // );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error creating seuil:', error);
    res.status(500).json({ error: 'Erreur lors de la création du seuil' });
  }
});

/**
 * @route PATCH /api/compteurs/seuils/:id
 * @desc Modifier un seuil d'alerte
 */
router.patch('/seuils/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'type_seuil', 'valeur_seuil_min', 'valeur_seuil_max',
      'niveau_alerte', 'message_alerte', 'action_automatique',
      'template_maintenance_id', 'actif'
    ];

    const fields = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${index}`);
        values.push(updates[field]);
        index++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE actifs_seuils_alertes 
       SET ${fields.join(', ')}
       WHERE id = $${index}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seuil non trouvé' });
    }

    // Log d'audit (désactivé temporairement - colonne action NOT NULL)
    // await logAudit(
    //   req.user.id,
    //   'UPDATE',
    //   'actifs_seuils_alertes',
    //   id,
    //   null,
    //   updates,
    //   'Modification d\'un seuil d\'alerte'
    // );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating seuil:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du seuil' });
  }
});

/**
 * @route DELETE /api/compteurs/seuils/:id
 * @desc Supprimer un seuil d'alerte
 */
router.delete('/seuils/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM actifs_seuils_alertes WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seuil non trouvé' });
    }

    // Log d'audit (désactivé temporairement - colonne action NOT NULL)
    // await logAudit(
    //   req.user.id,
    //   'DELETE',
    //   'actifs_seuils_alertes',
    //   id,
    //   result.rows[0],
    //   null,
    //   'Suppression d\'un seuil d\'alerte'
    // );

    res.json({
      success: true,
      message: 'Seuil supprimé avec succès'
    });

  } catch (error) {
    logger.error('Error deleting seuil:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du seuil' });
  }
});

// =====================================================
// GESTION DES ALERTES
// =====================================================

/**
 * @route GET /api/compteurs/alertes
 * @desc Obtenir toutes les alertes actives
 */
router.get('/alertes', authenticate, async (req, res) => {
  try {
    const { actif_id, niveau_alerte, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM v_alertes_actives WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (actif_id) {
      query += ` AND actif_id = $${paramIndex}`;
      params.push(actif_id);
      paramIndex++;
    }

    if (niveau_alerte) {
      query += ` AND niveau_alerte = $${paramIndex}`;
      params.push(niveau_alerte);
      paramIndex++;
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Compter le total
    let countQuery = 'SELECT COUNT(*) FROM alertes_historique WHERE acquitte = false';
    const countParams = [];
    if (actif_id) {
      countQuery += ' AND actif_id = $1';
      countParams.push(actif_id);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Error getting alertes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
  }
});

/**
 * @route POST /api/compteurs/alertes/:id/acquitter
 * @desc Acquitter une alerte
 */
router.post('/alertes/:id/acquitter', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire } = req.body;

    const result = await pool.query(
      `UPDATE alertes_historique 
       SET acquitte = true,
           acquitte_par = $1,
           acquitte_at = NOW(),
           commentaire_acquittement = $2
       WHERE id = $3
       RETURNING *`,
      [req.user.id, commentaire, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }

    await logAudit(
      req.user.id,
      'UPDATE',
      'alertes_historique',
      id,
      null,
      { acquitte: true, commentaire },
      'Acquittement d\'une alerte'
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error acquitting alerte:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acquittement de l\'alerte' });
  }
});

// =====================================================
// TEMPLATES DE MAINTENANCE PRÉVENTIVE
// =====================================================

/**
 * @route GET /api/compteurs/templates
 * @desc Obtenir tous les templates de maintenance préventive
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
      FROM templates_maintenance
      WHERE is_active = true
      ORDER BY nom`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error getting templates:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des templates' });
  }
});

/**
 * @route POST /api/compteurs/templates
 * @desc Créer un nouveau template
 */
router.post('/templates', authenticate, async (req, res) => {
  try {
    const {
      nom,
      description,
      type_maintenance,
      priorite,
      duree_estimee_heures,
      instructions,
      pieces_necessaires,
      competences_requises
    } = req.body;

    const result = await pool.query(
      `INSERT INTO templates_maintenance 
       (nom, description, type_maintenance, priorite,
        duree_estimee_heures, instructions,
        pieces_necessaires, competences_requises)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        nom,
        description,
        type_maintenance,
        priorite || 'normale',
        duree_estimee_heures,
        instructions,
        pieces_necessaires ? JSON.stringify(pieces_necessaires) : null,
        competences_requises ? JSON.stringify(competences_requises) : null
      ]
    );

    // Log d'audit (désactivé temporairement)
    // await logAudit(...)

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ error: 'Erreur lors de la création du template' });
  }
});

/**
 * @route PATCH /api/compteurs/templates/:id
 * @desc Modifier un template
 */
router.patch('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'nom', 'description', 'type_maintenance', 'priorite',
      'duree_estimee_heures', 'instructions',
      'pieces_necessaires', 'competences_requises', 'is_active'
    ];

    const fields = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'pieces_necessaires' || field === 'competences_requises') {
          fields.push(`${field} = $${index}`);
          values.push(JSON.stringify(updates[field]));
        } else {
          fields.push(`${field} = $${index}`);
          values.push(updates[field]);
        }
        index++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE templates_maintenance 
       SET ${fields.join(', ')}
       WHERE id = $${index}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template non trouvé' });
    }

    // Log d'audit (désactivé temporairement)
    // await logAudit(...)

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du template' });
  }
});

/**
 * @route DELETE /api/compteurs/templates/:id
 * @desc Supprimer un template
 */
router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM templates_maintenance WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template non trouvé' });
    }

    // Log d'audit (désactivé temporairement)
    // await logAudit(...)

    res.json({
      success: true,
      message: 'Template supprimé avec succès'
    });

  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du template' });
  }
});

module.exports = router;
