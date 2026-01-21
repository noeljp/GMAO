const pool = require('../config/database');
const { AppError } = require('../middleware/error.middleware');

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
async function hasPermission(userId, permissionCode) {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM utilisateurs_roles ur
      JOIN roles_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.utilisateur_id = $1 AND p.code = $2
    ) as has_permission`,
    [userId, permissionCode]
  );
  
  return result.rows[0].has_permission;
}

/**
 * Récupère toutes les permissions d'un utilisateur
 */
async function getUserPermissions(userId) {
  const result = await pool.query(
    `SELECT DISTINCT p.code, p.nom, p.module, p.action
     FROM utilisateurs_roles ur
     JOIN roles_permissions rp ON ur.role_id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     WHERE ur.utilisateur_id = $1`,
    [userId]
  );
  
  return result.rows;
}

/**
 * Vérifie si un utilisateur a un rôle spécifique
 */
async function hasRole(userId, roleName) {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM utilisateurs_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.utilisateur_id = $1 AND r.nom = $2
    ) as has_role`,
    [userId, roleName]
  );
  
  return result.rows[0].has_role;
}

/**
 * Middleware pour vérifier une permission
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Non authentifié', 401);
    }

    const allowed = await hasPermission(req.user.id, permissionCode);
    
    if (!allowed) {
      throw new AppError('Permission insuffisante', 403);
    }

    next();
  };
}

/**
 * Middleware pour vérifier plusieurs permissions (OR)
 */
function requireAnyPermission(...permissionCodes) {
  return async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Non authentifié', 401);
    }

    for (const code of permissionCodes) {
      const allowed = await hasPermission(req.user.id, code);
      if (allowed) {
        return next();
      }
    }

    throw new AppError('Permission insuffisante', 403);
  };
}

/**
 * Middleware pour vérifier un rôle minimum
 */
function requireRole(...roleNames) {
  return async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Non authentifié', 401);
    }

    for (const roleName of roleNames) {
      const allowed = await hasRole(req.user.id, roleName);
      if (allowed) {
        return next();
      }
    }

    throw new AppError('Rôle insuffisant', 403);
  };
}

module.exports = {
  hasPermission,
  getUserPermissions,
  hasRole,
  requirePermission,
  requireAnyPermission,
  requireRole
};
