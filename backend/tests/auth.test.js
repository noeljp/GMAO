const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/config/database');

describe('Authentication API', () => {
  let authToken;
  const testUser = {
    email: 'test@example.com',
    password: 'Test123!',
    nom: 'Test User',
    prenom: 'Test'
  };

  afterAll(async () => {
    // Nettoyage
    await pool.query('DELETE FROM utilisateurs WHERE email = $1', [testUser.email]);
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('should not register a user with existing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should require password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@example.com',
          nom: 'Test'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
      
      authToken = res.body.token;
    });

    it('should not login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should not login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should respect rate limiting', async () => {
      // Faire plusieurs tentatives rapides
      const promises = Array(6).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com',
            password: 'wrong'
          })
      );

      const results = await Promise.all(promises);
      const rateLimited = results.some(res => res.statusCode === 429);
      
      expect(rateLimited).toBe(true);
    }, 10000);
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('email', testUser.email);
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBe(401);
    });
  });
});
