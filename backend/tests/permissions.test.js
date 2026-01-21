const { hasPermission, getUserPermissions, hasRole } = require('../src/config/permissions');
const pool = require('../src/config/database');

describe('Permission System', () => {
  let testUserId;
  let adminRoleId;
  let technicienRoleId;

  beforeAll(async () => {
    // Créer un utilisateur de test
    const userResult = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom, prenom, is_active)
       VALUES ('permtest@example.com', '$2a$10$test', 'Permission', 'Test', true)
       RETURNING id`,
    );
    testUserId = userResult.rows[0].id;

    // Récupérer les rôles
    const rolesResult = await pool.query(
      `SELECT id, code FROM roles WHERE code IN ('admin', 'technicien')`
    );
    const roles = rolesResult.rows;
    adminRoleId = roles.find(r => r.code === 'admin')?.id;
    technicienRoleId = roles.find(r => r.code === 'technicien')?.id;
  });

  afterAll(async () => {
    // Nettoyage
    await pool.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [testUserId]);
    await pool.query('DELETE FROM utilisateurs WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('hasRole', () => {
    it('should return false when user has no roles', async () => {
      const result = await hasRole(testUserId, 'admin');
      expect(result).toBe(false);
    });

    it('should return true when user has the role', async () => {
      // Assigner le rôle admin
      await pool.query(
        'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
        [testUserId, adminRoleId]
      );

      const result = await hasRole(testUserId, 'admin');
      expect(result).toBe(true);
    });

    it('should return false when user has different role', async () => {
      const result = await hasRole(testUserId, 'technicien');
      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return admin permissions', async () => {
      const permissions = await getUserPermissions(testUserId);
      
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
      
      // L'admin devrait avoir la permission de créer des sites
      expect(permissions).toContain('sites.create');
    });

    it('should return empty array for user without roles', async () => {
      // Supprimer les rôles
      await pool.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [testUserId]);
      
      const permissions = await getUserPermissions(testUserId);
      expect(permissions).toEqual([]);
    });

    it('should cache permissions', async () => {
      // Réassigner le rôle
      await pool.query(
        'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
        [testUserId, technicienRoleId]
      );

      const start = Date.now();
      await getUserPermissions(testUserId);
      const firstCallTime = Date.now() - start;

      const start2 = Date.now();
      await getUserPermissions(testUserId);
      const secondCallTime = Date.now() - start2;

      // Le second appel devrait être plus rapide (cache)
      expect(secondCallTime).toBeLessThan(firstCallTime);
    });
  });

  describe('hasPermission', () => {
    beforeAll(async () => {
      // S'assurer que l'utilisateur a le rôle technicien
      await pool.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [testUserId]);
      await pool.query(
        'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
        [testUserId, technicienRoleId]
      );
    });

    it('should return true for allowed permission', async () => {
      const result = await hasPermission(testUserId, 'ordres_travail.view');
      expect(result).toBe(true);
    });

    it('should return false for denied permission', async () => {
      const result = await hasPermission(testUserId, 'sites.delete');
      expect(result).toBe(false);
    });

    it('should handle wildcard permissions', async () => {
      // Assigner le rôle admin qui a toutes les permissions
      await pool.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [testUserId]);
      await pool.query(
        'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
        [testUserId, adminRoleId]
      );

      const result = await hasPermission(testUserId, 'anything.permission');
      expect(result).toBe(true); // Admin a toutes les permissions
    });
  });
});
