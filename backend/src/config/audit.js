const pool = require('../config/database');
const logger = require('./logger');

/**
 * Enregistre une action dans l'audit log
 */
async function logAudit({
  userId,
  action,
  tableName,
  recordId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (utilisateur_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    logger.error('Failed to log audit', { error: error.message });
  }
}

/**
 * Middleware pour enregistrer automatiquement les actions
 */
function auditMiddleware(tableName, action) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Enregistrer l'audit après la réponse
      setImmediate(async () => {
        try {
          const recordId = data?.id || req.params.id;
          await logAudit({
            userId: req.user?.id,
            action,
            tableName,
            recordId,
            newValues: action === 'create' || action === 'update' ? data : null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
          });
        } catch (error) {
          logger.error('Audit middleware error', { error: error.message });
        }
      });
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Récupère l'historique d'audit pour un objet
 */
async function getAuditHistory(tableName, recordId, limit = 50) {
  const result = await pool.query(
    `SELECT a.*, u.prenom || ' ' || u.nom as utilisateur_nom
     FROM audit_log a
     LEFT JOIN utilisateurs u ON a.utilisateur_id = u.id
     WHERE a.table_name = $1 AND a.record_id = $2
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [tableName, recordId, limit]
  );
  return result.rows;
}

module.exports = {
  logAudit,
  auditMiddleware,
  getAuditHistory
};
