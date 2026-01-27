const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/config/database');

describe('Resources API', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Create a test user and login
    const userRes = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, prenom, nom, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['test@example.com', 'hashed_password', 'Test', 'User', 'admin']
    );
    testUserId = userRes.rows[0].id;

    // Mock authentication - in real test, would login properly
    authToken = 'mock_token';
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM utilisateurs WHERE email = $1', ['test@example.com']);
    await pool.end();
  });

  describe('GET /api/resources', () => {
    it('should return list of resources', async () => {
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/resources/types/list', () => {
    it('should return list of resource types', async () => {
      const response = await request(app)
        .get('/api/resources/types/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/resources/check-availability', () => {
    it('should check resource availability', async () => {
      // First, create a resource type and resource
      const typeRes = await pool.query(
        `INSERT INTO resource_types (nom, type) VALUES ($1, $2) RETURNING id`,
        ['Test Type', 'materiel']
      );
      
      const resourceRes = await pool.query(
        `INSERT INTO resources (nom, code, resource_type_id, quantite_disponible)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Test Resource', 'TEST001', typeRes.rows[0].id, 5]
      );
      
      const resourceId = resourceRes.rows[0].id;

      const response = await request(app)
        .post('/api/resources/check-availability')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resource_id: resourceId,
          date_debut: '2024-01-01T10:00:00Z',
          date_fin: '2024-01-01T12:00:00Z',
          quantite_requise: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('conflicts');

      // Cleanup
      await pool.query('DELETE FROM resources WHERE id = $1', [resourceId]);
      await pool.query('DELETE FROM resource_types WHERE id = $1', [typeRes.rows[0].id]);
    });
  });
});

describe('Ordres de Travail API with Resources', () => {
  let authToken;
  let testActifId;
  let testResourceId;

  beforeAll(async () => {
    // Setup test data
    authToken = 'mock_token';
    
    // Create test actif
    const actifRes = await pool.query(
      `INSERT INTO actifs (code_interne, description) 
       VALUES ($1, $2) RETURNING id`,
      ['TEST001', 'Test Asset']
    );
    testActifId = actifRes.rows[0].id;

    // Create test resource
    const typeRes = await pool.query(
      `INSERT INTO resource_types (nom, type) VALUES ($1, $2) RETURNING id`,
      ['Test Type', 'materiel']
    );
    
    const resourceRes = await pool.query(
      `INSERT INTO resources (nom, code, resource_type_id)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Test Resource', 'RES001', typeRes.rows[0].id]
    );
    testResourceId = resourceRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM actifs WHERE code_interne = $1', ['TEST001']);
    await pool.query('DELETE FROM resources WHERE code = $1', ['RES001']);
  });

  describe('POST /api/ordres-travail with resources', () => {
    it('should create ordre de travail with resource allocation', async () => {
      const response = await request(app)
        .post('/api/ordres-travail')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titre: 'Test Task',
          description: 'Test Description',
          type: 'correctif',
          priorite: 'moyenne',
          actif_id: testActifId,
          date_prevue_debut: '2024-01-01T10:00:00Z',
          date_prevue_fin: '2024-01-01T12:00:00Z',
          duree_estimee: 120,
          resources: [
            {
              resource_id: testResourceId,
              quantite_requise: 1,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.titre).toBe('Test Task');

      // Cleanup
      if (response.body.id) {
        await pool.query('DELETE FROM ordres_travail WHERE id = $1', [response.body.id]);
      }
    });
  });

  describe('GET /api/ordres-travail with filters', () => {
    it('should filter ordres by date range', async () => {
      const response = await request(app)
        .get('/api/ordres-travail')
        .query({
          date_debut_min: '2024-01-01',
          date_fin_max: '2024-12-31',
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should filter ordres by type', async () => {
      const response = await request(app)
        .get('/api/ordres-travail')
        .query({ type: 'correctif' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every((o) => o.type === 'correctif')).toBe(true);
    });
  });
});
