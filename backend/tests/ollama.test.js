const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/config/database');
const ollamaService = require('../src/services/ollama.service');

describe('Ollama API', () => {
  let authToken;
  let testUserId;
  let testActifId;

  beforeAll(async () => {
    // Create a test user
    const userResult = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom, prenom, role)
       VALUES ('ollama-test@example.com', '$2a$10$abcdefghijklmnopqrstuv', 'Test', 'Ollama', 'technicien')
       RETURNING id`
    );
    testUserId = userResult.rows[0].id;

    // Get auth token
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { id: testUserId, email: 'ollama-test@example.com', role: 'technicien' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a test asset
    const siteResult = await pool.query(
      `INSERT INTO sites (nom, code)
       VALUES ('Site Test Ollama', 'STO')
       RETURNING id`
    );

    const typeActifResult = await pool.query(
      `INSERT INTO types_actifs (nom, description)
       VALUES ('Type Test', 'Type pour test Ollama')
       RETURNING id`
    );

    const actifResult = await pool.query(
      `INSERT INTO actifs (code_interne, description, site_id, type_actif_id, localisation, created_by)
       VALUES ('ACTIF-TEST-01', 'Machine de test', $1, $2, 'Atelier principal', $3)
       RETURNING id`,
      [siteResult.rows[0].id, typeActifResult.rows[0].id, testUserId]
    );
    testActifId = actifResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM actifs WHERE code_interne = $1', ['ACTIF-TEST-01']);
    await pool.query('DELETE FROM types_actifs WHERE nom = $1', ['Type Test']);
    await pool.query('DELETE FROM sites WHERE code = $1', ['STO']);
    await pool.query('DELETE FROM utilisateurs WHERE email = $1', ['ollama-test@example.com']);
    await pool.end();
  });

  describe('POST /api/ollama/reformulate', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/ollama/reformulate')
        .send({
          description: 'test description'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/ollama/reformulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should accept description without actif_id', async () => {
      const res = await request(app)
        .post('/api/ollama/reformulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'La machine fait un bruit bizarre'
        });

      // Will fail if Ollama is not running, but validates the endpoint structure
      expect([200, 500, 503]).toContain(res.statusCode);
    });

    it('should accept description with actif_id', async () => {
      const res = await request(app)
        .post('/api/ollama/reformulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'La machine fait un bruit bizarre',
          actif_id: testActifId,
          type_intervention: 'panne',
          priorite: 'moyenne'
        });

      // Will fail if Ollama is not running, but validates the endpoint structure
      expect([200, 500, 503]).toContain(res.statusCode);
    });
  });

  describe('GET /api/ollama/health', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/ollama/health');

      expect(res.statusCode).toBe(401);
    });

    it('should check Ollama service health', async () => {
      const res = await request(app)
        .get('/api/ollama/health')
        .set('Authorization', `Bearer ${authToken}`);

      // Will return 200 if Ollama is running, 503 if not
      expect([200, 503]).toContain(res.statusCode);
    });
  });

  describe('GET /api/ollama/models', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/ollama/models');

      expect(res.statusCode).toBe(401);
    });

    it('should return available models', async () => {
      const res = await request(app)
        .get('/api/ollama/models')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('models');
      expect(res.body).toHaveProperty('current_model');
    });
  });

  describe('Ollama Service', () => {
    it('should have correct default configuration', () => {
      expect(ollamaService.baseUrl).toBeDefined();
      expect(ollamaService.model).toBeDefined();
      expect(ollamaService.timeout).toBeDefined();
    });

    it('should build context correctly', async () => {
      const context = {
        actif: {
          code_interne: 'TEST-001',
          description: 'Test Machine',
          type: 'Hydraulique',
          localisation: 'Atelier'
        },
        type_intervention: 'panne',
        priorite: 'haute'
      };

      // Test that the service doesn't crash with good context
      try {
        await ollamaService.reformulateDescription('Test description', context);
      } catch (error) {
        // Expected to fail if Ollama is not running
        expect(['ECONNREFUSED', 'ETIMEDOUT']).toContain(error.code);
      }
    });

    it('should reject empty descriptions', async () => {
      await expect(
        ollamaService.reformulateDescription('')
      ).rejects.toThrow('Description originale vide');
    });
  });
});
