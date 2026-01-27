const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');

// Get dashboard statistics
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  // Statistiques générales
  const [
    actifs,
    ot,
    demandes,
    utilisateurs
  ] = await Promise.all([
    // Total actifs par statut
    pool.query(`
      SELECT 
        COALESCE(ast.nom, 'Non défini') as statut,
        COALESCE(ast.couleur, '#6c757d') as couleur,
        COUNT(a.id) as count
      FROM actifs a
      LEFT JOIN actifs_statuts ast ON ast.id = a.statut_id
      WHERE a.is_active = true
      GROUP BY ast.id, ast.nom, ast.couleur, ast.ordre
      ORDER BY COALESCE(ast.ordre, 999)
    `),
    
    // OT par statut
    pool.query(`
      SELECT 
        statut,
        COUNT(*) as count
      FROM ordres_travail
      WHERE is_active = true
      GROUP BY statut
    `),
    
    // Demandes par statut
    pool.query(`
      SELECT 
        statut,
        COUNT(*) as count
      FROM demandes_intervention
      WHERE is_active = true
      GROUP BY statut
    `),
    
    // Utilisateurs actifs
    pool.query(`
      SELECT COUNT(*) as count
      FROM utilisateurs
      WHERE is_active = true
    `)
  ]);

  // OT par priorité
  const otParPriorite = await pool.query(`
    SELECT 
      priorite,
      COUNT(*) as count
    FROM ordres_travail
    WHERE is_active = true AND statut IN ('planifie', 'assigne', 'en_cours')
    GROUP BY priorite
  `);

  // Activité récente (dernières 24h)
  const activiteRecente = await pool.query(`
    SELECT 
      'ot' as type,
      id,
      titre as titre,
      created_at
    FROM ordres_travail
    WHERE created_at > NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT 
      'demande' as type,
      id,
      titre as titre,
      created_at
    FROM demandes_intervention
    WHERE created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  // Taux de complétion des OT (30 derniers jours)
  const tauxCompletion = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE statut IN ('termine', 'valide')) as termines,
      COUNT(*) as total,
      ROUND(
        COUNT(*) FILTER (WHERE statut IN ('termine', 'valide'))::numeric / 
        NULLIF(COUNT(*), 0) * 100, 
        2
      ) as taux
    FROM ordres_travail
    WHERE created_at > NOW() - INTERVAL '30 days'
  `);

  // Actifs critiques en maintenance
  const actifsCritiques = await pool.query(`
    SELECT COUNT(*) as count
    FROM actifs a
    JOIN actifs_criticites ac ON a.criticite_id = ac.id
    JOIN actifs_statuts ast ON a.statut_id = ast.id
    WHERE a.is_active = true 
    AND ac.niveau = 3
    AND ast.nom = 'En maintenance'
  `);

  // Temps moyen de résolution des OT (7 derniers jours)
  const tempsMoyen = await pool.query(`
    SELECT 
      AVG(EXTRACT(EPOCH FROM (date_fin_reel - date_debut_reel))/3600) as heures_moyennes
    FROM ordres_travail
    WHERE date_fin_reel IS NOT NULL 
    AND date_debut_reel IS NOT NULL
    AND date_fin_reel > NOW() - INTERVAL '7 days'
  `);

  // Performance par technicien (OT complétés ce mois)
  const performanceTechniciens = await pool.query(`
    SELECT 
      u.prenom || ' ' || u.nom as technicien,
      COUNT(*) as ot_completes,
      AVG(EXTRACT(EPOCH FROM (ot.date_fin_reel - ot.date_debut_reel))/3600) as heures_moyennes
    FROM ordres_travail ot
    JOIN utilisateurs u ON ot.technicien_id = u.id
    WHERE ot.statut IN ('termine', 'valide')
    AND ot.date_fin_reel > DATE_TRUNC('month', NOW())
    GROUP BY u.id, u.prenom, u.nom
    ORDER BY ot_completes DESC
    LIMIT 5
  `);

  res.json({
    resume: {
      actifs: {
        total: actifs.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        par_statut: actifs.rows
      },
      ordres_travail: {
        total: ot.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        par_statut: ot.rows,
        par_priorite: otParPriorite.rows
      },
      demandes: {
        total: demandes.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        par_statut: demandes.rows
      },
      utilisateurs: {
        actifs: parseInt(utilisateurs.rows[0].count)
      }
    },
    kpis: {
      taux_completion: tauxCompletion.rows[0],
      actifs_critiques_maintenance: parseInt(actifsCritiques.rows[0].count),
      temps_moyen_resolution: parseFloat(tempsMoyen.rows[0].heures_moyennes || 0).toFixed(2)
    },
    activite_recente: activiteRecente.rows,
    performance_techniciens: performanceTechniciens.rows
  });
}));

// Get statistiques par période
router.get('/stats/periode', authenticate, asyncHandler(async (req, res) => {
  const { debut, fin } = req.query;
  
  if (!debut || !fin) {
    throw new AppError('Dates de début et fin requises', 400);
  }

  // OT créés par jour
  const otParJour = await pool.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM ordres_travail
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [debut, fin]);

  // Demandes créées par jour
  const demandesParJour = await pool.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM demandes_intervention
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [debut, fin]);

  res.json({
    ordres_travail: otParJour.rows,
    demandes: demandesParJour.rows
  });
}));

module.exports = router;
