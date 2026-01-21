const pool = require('../config/database');
const { hasRole } = require('./permissions');
const { logAudit } = require('./audit');
const { AppError } = require('../middleware/error.middleware');
const logger = require('./logger');

/**
 * Vérifie si une transition de statut est autorisée
 */
async function isTransitionAllowed(userId, entite, statutSource, statutDestination) {
  // Récupérer la règle de transition
  const result = await pool.query(
    `SELECT * FROM workflow_transitions 
     WHERE entite = $1 
     AND statut_source = $2 
     AND statut_destination = $3`,
    [entite, statutSource, statutDestination]
  );

  if (result.rows.length === 0) {
    return { allowed: false, reason: 'Transition non définie' };
  }

  const transition = result.rows[0];

  // Vérifier les rôles autorisés
  if (transition.roles_autorises && transition.roles_autorises.length > 0) {
    let hasRequiredRole = false;
    for (const role of transition.roles_autorises) {
      if (await hasRole(userId, role)) {
        hasRequiredRole = true;
        break;
      }
    }

    if (!hasRequiredRole) {
      return { 
        allowed: false, 
        reason: `Rôle insuffisant. Rôles requis: ${transition.roles_autorises.join(', ')}` 
      };
    }
  }

  // Vérifier les conditions (si définies)
  if (transition.conditions) {
    // TODO: Implémenter la vérification des conditions
    // Par exemple: vérifier que toutes les pièces sont disponibles, etc.
  }

  return { allowed: true, transition };
}

/**
 * Exécute une transition de statut
 */
async function executeTransition({
  userId,
  entite,
  entiteId,
  nouveauStatut,
  commentaire = null,
  metadata = null
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Récupérer le statut actuel
    let currentStatus;
    const tableName = entite === 'ot' ? 'ordres_travail' : 'demandes_intervention';
    
    const currentResult = await client.query(
      `SELECT statut FROM ${tableName} WHERE id = $1`,
      [entiteId]
    );

    if (currentResult.rows.length === 0) {
      throw new AppError(`${entite} non trouvé`, 404);
    }

    currentStatus = currentResult.rows[0].statut;

    // Vérifier si la transition est autorisée
    const { allowed, reason, transition } = await isTransitionAllowed(
      userId,
      entite,
      currentStatus,
      nouveauStatut
    );

    if (!allowed) {
      throw new AppError(reason, 403);
    }

    // Mettre à jour le statut
    await client.query(
      `UPDATE ${tableName} 
       SET statut = $1, updated_at = NOW(), updated_by = $2 
       WHERE id = $3`,
      [nouveauStatut, userId, entiteId]
    );

    // Enregistrer dans l'historique du workflow
    await client.query(
      `INSERT INTO workflow_historique 
       (entite, entite_id, statut_source, statut_destination, utilisateur_id, commentaire, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entite, entiteId, currentStatus, nouveauStatut, userId, commentaire, metadata ? JSON.stringify(metadata) : null]
    );

    // Audit log
    await logAudit({
      userId,
      action: 'status_change',
      tableName,
      recordId: entiteId,
      oldValues: { statut: currentStatus },
      newValues: { statut: nouveauStatut, commentaire }
    });

    // Exécuter les actions définies dans la transition (notifications, etc.)
    if (transition.actions) {
      // TODO: Implémenter les actions (envoyer notifications, etc.)
      logger.info('Transition actions', { 
        transition: transition.id, 
        actions: transition.actions 
      });
    }

    await client.query('COMMIT');

    logger.info('Workflow transition executed', {
      entite,
      entiteId,
      from: currentStatus,
      to: nouveauStatut,
      userId
    });

    return {
      success: true,
      ancien_statut: currentStatus,
      nouveau_statut: nouveauStatut
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Récupère les transitions disponibles pour un état donné
 */
async function getAvailableTransitions(userId, entite, currentStatut) {
  const result = await pool.query(
    `SELECT statut_destination, roles_autorises 
     FROM workflow_transitions 
     WHERE entite = $1 AND statut_source = $2`,
    [entite, currentStatut]
  );

  const transitions = [];

  for (const row of result.rows) {
    // Vérifier si l'utilisateur a le rôle requis
    if (!row.roles_autorises || row.roles_autorises.length === 0) {
      transitions.push({
        statut_destination: row.statut_destination,
        roles_autorises: row.roles_autorises
      });
      continue;
    }

    for (const role of row.roles_autorises) {
      if (await hasRole(userId, role)) {
        transitions.push({
          statut_destination: row.statut_destination,
          roles_autorises: row.roles_autorises
        });
        break;
      }
    }
  }

  return transitions;
}

/**
 * Récupère l'historique des transitions pour une entité
 */
async function getWorkflowHistory(entite, entiteId) {
  const result = await pool.query(
    `SELECT wh.*, u.prenom || ' ' || u.nom as utilisateur_nom
     FROM workflow_historique wh
     LEFT JOIN utilisateurs u ON wh.utilisateur_id = u.id
     WHERE wh.entite = $1 AND wh.entite_id = $2
     ORDER BY wh.created_at DESC`,
    [entite, entiteId]
  );

  return result.rows;
}

module.exports = {
  isTransitionAllowed,
  executeTransition,
  getAvailableTransitions,
  getWorkflowHistory
};
