const { isTransitionAllowed, executeTransition } = require('../src/config/workflow');
const pool = require('../src/config/database');

describe('Workflow System', () => {
  let testUserId;
  let testOTId;
  let adminRoleId;

  beforeAll(async () => {
    // Créer un utilisateur admin
    const userResult = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom, prenom, is_active)
       VALUES ('workflowtest@example.com', '$2a$10$test', 'Workflow', 'Test', true)
       RETURNING id`,
    );
    testUserId = userResult.rows[0].id;

    // Assigner le rôle admin
    const roleResult = await pool.query(`SELECT id FROM roles WHERE code = 'admin'`);
    adminRoleId = roleResult.rows[0].id;
    
    await pool.query(
      'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
      [testUserId, adminRoleId]
    );

    // Créer un OT de test
    const siteResult = await pool.query('SELECT id FROM sites WHERE is_active = true LIMIT 1');
    const actifResult = await pool.query('SELECT id FROM actifs WHERE is_active = true LIMIT 1');
    
    if (actifResult.rows.length > 0) {
      const otResult = await pool.query(
        `INSERT INTO ordres_travail 
         (titre, description, actif_id, type, priorite, statut, created_by, created_at, updated_at)
         VALUES ('Test OT', 'Description test', $1, 'correctif', 'moyenne', 'brouillon', $2, NOW(), NOW())
         RETURNING id`,
        [actifResult.rows[0].id, testUserId]
      );
      testOTId = otResult.rows[0].id;
    }
  });

  afterAll(async () => {
    // Nettoyage
    if (testOTId) {
      await pool.query('DELETE FROM workflow_transitions WHERE entite_id = $1', [testOTId]);
      await pool.query('DELETE FROM ordres_travail WHERE id = $1', [testOTId]);
    }
    await pool.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [testUserId]);
    await pool.query('DELETE FROM utilisateurs WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('isTransitionAllowed', () => {
    it('should allow valid transition', async () => {
      const result = await isTransitionAllowed(
        testUserId,
        'ordre_travail',
        'brouillon',
        'planifie'
      );
      
      expect(result).toBe(true);
    });

    it('should reject invalid transition', async () => {
      const result = await isTransitionAllowed(
        testUserId,
        'ordre_travail',
        'brouillon',
        'termine' // Saut d'étapes non autorisé
      );
      
      expect(result).toBe(false);
    });

    it('should check role permissions', async () => {
      // Créer un utilisateur sans permissions
      const noPermUserResult = await pool.query(
        `INSERT INTO utilisateurs (email, password_hash, nom, prenom, is_active)
         VALUES ('noperm@example.com', '$2a$10$test', 'No', 'Perm', true)
         RETURNING id`,
      );
      const noPermUserId = noPermUserResult.rows[0].id;

      const result = await isTransitionAllowed(
        noPermUserId,
        'ordre_travail',
        'brouillon',
        'planifie'
      );
      
      // Sans rôle approprié, la transition devrait être refusée
      expect(result).toBe(false);

      // Nettoyage
      await pool.query('DELETE FROM utilisateurs WHERE id = $1', [noPermUserId]);
    });
  });

  describe('executeTransition', () => {
    it('should execute valid transition', async () => {
      if (!testOTId) {
        console.log('Skipping test: no test OT available');
        return;
      }

      const result = await executeTransition({
        userId: testUserId,
        entite: 'ordre_travail',
        entiteId: testOTId,
        nouveauStatut: 'planifie',
        commentaire: 'Planification de l\'OT'
      });

      expect(result).toHaveProperty('id', testOTId);
      expect(result.statut).toBe('planifie');

      // Vérifier que la transition a été enregistrée
      const transitionResult = await pool.query(
        `SELECT * FROM workflow_transitions 
         WHERE entite_type = 'ordre_travail' AND entite_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [testOTId]
      );

      expect(transitionResult.rows.length).toBe(1);
      expect(transitionResult.rows[0].statut_destination).toBe('planifie');
      expect(transitionResult.rows[0].commentaire).toBe('Planification de l\'OT');
    });

    it('should reject invalid transition', async () => {
      if (!testOTId) {
        console.log('Skipping test: no test OT available');
        return;
      }

      await expect(
        executeTransition({
          userId: testUserId,
          entite: 'ordre_travail',
          entiteId: testOTId,
          nouveauStatut: 'annule', // Transition non autorisée depuis planifie
          commentaire: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should store metadata', async () => {
      if (!testOTId) {
        console.log('Skipping test: no test OT available');
        return;
      }

      await executeTransition({
        userId: testUserId,
        entite: 'ordre_travail',
        entiteId: testOTId,
        nouveauStatut: 'en_cours',
        commentaire: 'Début des travaux',
        metadata: { 
          temperature: 25,
          equipement: 'Pompe A'
        }
      });

      const transitionResult = await pool.query(
        `SELECT metadata FROM workflow_transitions 
         WHERE entite_type = 'ordre_travail' AND entite_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [testOTId]
      );

      expect(transitionResult.rows[0].metadata).toHaveProperty('temperature', 25);
      expect(transitionResult.rows[0].metadata).toHaveProperty('equipement', 'Pompe A');
    });
  });
});
