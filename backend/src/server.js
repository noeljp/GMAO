require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting (limites augmentées pour le développement)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limite de 1000 requêtes par IP (développement)
  message: 'Trop de requêtes, veuillez réessayer plus tard.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 tentatives de connexion max (développement)
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.'
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/sites', require('./routes/sites.routes'));
app.use('/api/actifs', require('./routes/actifs.routes'));
app.use('/api/types-actifs', require('./routes/types-actifs.routes'));
app.use('/api/ordres-travail', require('./routes/ordresTravail.routes'));
app.use('/api/demandes', require('./routes/demandes.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/documents', require('./routes/documents.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/mqtt', require('./routes/mqtt.routes'));
app.use('/api/iot-devices', require('./routes/iot-devices.routes'));
app.use('/api/apru40', require('./routes/apru40.routes'));
app.use('/api/compteurs', require('./routes/compteurs.routes'));
app.use('/api/resources', require('./routes/resources.routes'));
app.use('/api/ollama', require('./routes/ollama.routes'));
app.use('/api/pieces', require('./routes/pieces.routes'));
app.use('/api/whisper', require('./routes/whisper.routes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'GMAO API is running' });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
  
  // Démarrer le service MQTT
  const mqttService = require('./config/mqtt');
  try {
    await mqttService.startAll();
    logger.info('MQTT Service initialized');
  } catch (error) {
    logger.error('Error starting MQTT service:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...');
  const mqttService = require('./config/mqtt');
  await mqttService.stopAll();
  process.exit(0);
});

module.exports = app;
