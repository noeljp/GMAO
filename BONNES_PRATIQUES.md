# 📚 Bonnes Pratiques de Développement - GMAO

## 🔒 Sécurité

### ✅ À FAIRE
- Toujours utiliser des requêtes paramétrées (jamais de concaténation SQL)
- Valider TOUTES les entrées utilisateur avec express-validator
- Utiliser `asyncHandler` pour les routes async
- Logger les actions sensibles (connexion, modification, suppression)
- Ne JAMAIS retourner `password_hash` dans les réponses
- Vérifier les permissions avant chaque action
- Utiliser HTTPS en production
- Rotation régulière des secrets (JWT_SECRET)

### ❌ À ÉVITER
- Console.log pour les logs (utiliser Winston)
- Try/catch répétitifs (utiliser asyncHandler)
- SELECT * sans pagination
- Mots de passe en clair
- Secrets dans le code source
- Erreurs détaillées en production

## 🏗️ Architecture

### Structure des Routes
```javascript
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const pool = require('../config/database');
const logger = require('../config/logger');

// GET avec pagination
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  // Count total
  const countResult = await pool.query('SELECT COUNT(*) FROM table WHERE is_active = true');
  const total = parseInt(countResult.rows[0].count);
  
  // Fetch data
  const result = await pool.query(
    'SELECT * FROM table WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  
  res.json({
    data: result.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}));

// POST avec validation
router.post('/', authenticate, authorize('admin'), [
  body('field').trim().notEmpty().withMessage('Field requis'),
  body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation échouée', 400);
  }
  
  const { field } = req.body;
  
  const result = await pool.query(
    'INSERT INTO table (field, created_by) VALUES ($1, $2) RETURNING *',
    [field, req.user.id]
  );
  
  logger.info('Item created', { itemId: result.rows[0].id, userId: req.user.id });
  res.status(201).json(result.rows[0]);
}));
```

## 🗄️ Base de Données

### Conventions
- Toujours utiliser UUID pour les IDs
- Ajouter `created_at`, `updated_at`, `created_by`, `updated_by`
- Ajouter `is_active` pour soft delete
- Index sur les colonnes de recherche/filtrage
- Foreign keys avec ON DELETE CASCADE ou RESTRICT

### Migrations
```sql
-- Toujours versionner les migrations
-- Format: YYYYMMDD_description.sql

-- Exemple: 20260121_add_users_table.sql
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
```

## 🎨 Frontend (React)

### Bonnes Pratiques
```javascript
// ✅ Utiliser React Query pour les appels API
const { data: response, isLoading, error } = useQuery('key', async () => {
  const res = await axios.get('/api/endpoint');
  return res.data;
});

// ✅ Extraire les données de la réponse paginée
const items = response?.data || [];
const pagination = response?.pagination;

// ✅ Gestion des erreurs
if (error) {
  return <Alert severity="error">Erreur: {error.message}</Alert>;
}

// ✅ Loading state
if (isLoading) return <CircularProgress />;

// ❌ Ne pas stocker de tokens dans localStorage sans précaution
// ❌ Ne pas faire d'appels API dans useEffect sans cleanup
// ❌ Ne pas oublier la validation des formulaires
```

## 📝 Logs

### Niveaux de Log
```javascript
// ERROR - Erreurs critiques nécessitant une action
logger.error('Failed to process payment', { 
  userId, 
  amount, 
  error: err.message 
});

// WARN - Situations anormales mais gérables
logger.warn('Deprecated API used', { endpoint, userId });

// INFO - Événements importants
logger.info('User logged in', { userId, ip: req.ip });

// DEBUG - Détails pour le développement
logger.debug('Query executed', { query, params, duration });
```

## 🧪 Tests

### Structure des Tests
```javascript
describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should return token with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });
    
    it('should return 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      
      expect(res.status).toBe(401);
    });
    
    it('should return 400 with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', password: 'password123' });
      
      expect(res.status).toBe(400);
    });
  });
});
```

## 🚀 Déploiement

### Checklist Pré-Production
- [ ] Variables d'environnement configurées
- [ ] JWT_SECRET unique et fort (32+ caractères)
- [ ] CORS restreint au domaine de production
- [ ] HTTPS activé et forcé
- [ ] Migrations de base de données exécutées
- [ ] Logs configurés et rotatifs
- [ ] Monitoring actif (uptime, erreurs)
- [ ] Backups automatiques configurés
- [ ] Certificats SSL valides
- [ ] Rate limiting vérifié
- [ ] Tests de charge effectués
- [ ] Documentation à jour

### Variables d'Environnement Production
```env
NODE_ENV=production
PORT=5000
DB_HOST=prod-db-host
DB_NAME=gmao_prod
DB_USER=gmao_prod_user
DB_PASSWORD=<strong-password>
JWT_SECRET=<32-chars-random-string>
JWT_EXPIRES_IN=1h
CORS_ORIGIN=https://votre-domaine.com
LOG_LEVEL=warn
```

## 📊 Performance

### Optimisations
1. **Database**
   - Index sur colonnes de recherche
   - EXPLAIN ANALYZE pour queries lentes
   - Connection pooling (déjà configuré)
   - Pagination obligatoire

2. **API**
   - Compression gzip
   - Cache Redis pour données fréquentes
   - Rate limiting
   - CDN pour assets statiques

3. **Frontend**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Bundle size monitoring

## 🔍 Debugging

### Problèmes Courants

**Erreur: "password_hash not found"**
- Vérifier que le seed a été exécuté
- Hash bcrypt valide dans seed.sql

**Rate limiting bloque tout**
- Attendre 15 minutes
- Ou redémarrer le serveur en dev

**Pagination ne fonctionne pas**
- Vérifier format de réponse: `{ data: [], pagination: {} }`
- Frontend adapté pour `response.data`

**Token invalide**
- Vérifier JWT_SECRET identique entre génération et validation
- Token peut avoir expiré

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Security](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
