const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/config/database');

describe('Sites API', () => {
  let authToken;
  let testSiteId;
  let testUserId;

  beforeAll(async () => {
    // Créer un utilisateur de test
    const userResult = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom, prenom, is_active)
       VALUES ('sitetest@example.com', '$2a$10$cEQlYmENhU23mCFlZ2jDJ.fku5uznSWNLmpDqAjAr1.HVkzEIN8y6', 'Test', 'Site', true)
       RETURNING id`,
    );
    testUserId = userResult.rows[0].id;

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@gmao.com',
        password: 'Admin123!'
      });
    
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Nettoyage
    if (testSiteId) {
      await pool.query('DELETE FROM sites WHERE id = $1', [testSiteId]);
    }
    await pool.query('DELETE FROM utilisateurs WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/sites', () => {
    it('should create a new site', async () => {
      const siteData = {
        nom: 'Site Test',
        code: 'TST01',
        adresse: '123 Test Street',
        ville: 'Test City',
        code_postal: '12345',
        pays: 'France'
      };

      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send(siteData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.nom).toBe(siteData.nom);
      expect(res.body.code).toBe(siteData.code);
      
      testSiteId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sites')
        .send({ nom: 'Test' });

      expect(res.statusCode).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'TEST' }); // nom manquant

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/sites', () => {
    it('should return paginated sites', async () => {
      const res = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total');
    });

    it('should support pagination parameters', async () => {
      const res = await request(app)
        .get('/api/sites?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/sites/:id', () => {
    it('should return a specific site', async () => {
      const res = await request(app)
        .get(`/api/sites/${testSiteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(testSiteId);
      expect(res.body).toHaveProperty('nom');
    });

    it('should return 404 for non-existent site', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/sites/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/sites/:id', () => {
    it('should update a site', async () => {
      const updateData = {
        nom: 'Site Test Updated',
        ville: 'Updated City'
      };

      const res = await request(app)
        .patch(`/api/sites/${testSiteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.nom).toBe(updateData.nom);
      expect(res.body.ville).toBe(updateData.ville);
    });
  });

  describe('DELETE /api/sites/:id', () => {
    it('should soft delete a site', async () => {
      const res = await request(app)
        .delete(`/api/sites/${testSiteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);

      // Vérifier que le site existe toujours mais est inactif
      const checkRes = await pool.query(
        'SELECT is_active FROM sites WHERE id = $1',
        [testSiteId]
      );
      expect(checkRes.rows[0].is_active).toBe(false);
    });
  });
});
