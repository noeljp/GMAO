# ✅ CHECKLIST DÉPLOIEMENT PRODUCTION

## 🔐 SÉCURITÉ (CRITIQUE)

### Avant TOUT déploiement en production

- [ ] **Changer le mot de passe admin par défaut**
  ```sql
  -- Se connecter à PostgreSQL
  psql -U postgres -d gmao_db
  
  -- Générer un nouveau hash
  -- Utiliser: https://bcrypt-generator.com/ avec 10 rounds
  -- Ou en Node.js: bcrypt.hashSync('votre_nouveau_password', 10)
  
  UPDATE utilisateurs 
  SET password = '$2b$10$VOTRE_NOUVEAU_HASH' 
  WHERE email = 'admin@gmao.com';
  ```

- [ ] **Générer un JWT_SECRET fort**
  ```bash
  # Générer un secret aléatoire de 256 bits
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Copier le résultat dans votre fichier .env production
  JWT_SECRET=<le_secret_généré>
  ```

- [ ] **Configurer les variables d'environnement production**
  ```bash
  # Créer un fichier .env.production
  NODE_ENV=production
  PORT=5000
  
  # Base de données
  DB_HOST=<votre_hote_postgresql>
  DB_PORT=5432
  DB_NAME=gmao_db
  DB_USER=<utilisateur_production>
  DB_PASSWORD=<mot_de_passe_fort>
  
  # JWT (utiliser le secret généré ci-dessus)
  JWT_SECRET=<votre_secret_256_bits>
  JWT_EXPIRES_IN=24h
  
  # CORS (votre domaine de production)
  CORS_ORIGIN=https://votre-domaine.com
  
  # Logs
  LOG_LEVEL=warn
  ```

- [ ] **Activer HTTPS avec certificat SSL**
  ```nginx
  # Exemple de configuration nginx
  server {
      listen 443 ssl http2;
      server_name votre-domaine.com;
      
      ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
      
      location / {
          proxy_pass http://localhost:3000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
      }
      
      location /api {
          proxy_pass http://localhost:5000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
      }
  }
  ```

- [ ] **Configurer sauvegardes automatiques PostgreSQL**
  ```bash
  # Créer un script de backup
  sudo nano /usr/local/bin/backup-gmao.sh
  
  #!/bin/bash
  BACKUP_DIR="/var/backups/gmao"
  DATE=$(date +%Y%m%d_%H%M%S)
  
  mkdir -p $BACKUP_DIR
  pg_dump -U postgres gmao_db | gzip > $BACKUP_DIR/gmao_backup_$DATE.sql.gz
  
  # Garder seulement les 30 derniers backups
  find $BACKUP_DIR -name "gmao_backup_*.sql.gz" -mtime +30 -delete
  
  # Rendre le script exécutable
  sudo chmod +x /usr/local/bin/backup-gmao.sh
  
  # Ajouter à crontab (backup quotidien à 2h du matin)
  sudo crontab -e
  0 2 * * * /usr/local/bin/backup-gmao.sh
  ```

- [ ] **Vérifier les permissions fichiers**
  ```bash
  # Les fichiers .env ne doivent PAS être accessibles publiquement
  chmod 600 .env
  chmod 600 .env.production
  
  # Les uploads doivent avoir les bonnes permissions
  chmod 755 backend/uploads
  ```

---

## 📊 MONITORING (RECOMMANDÉ)

- [ ] **Installer et configurer Sentry pour le suivi des erreurs**
  ```bash
  # Backend
  cd backend
  npm install @sentry/node
  
  # Frontend
  cd frontend
  npm install @sentry/react
  ```
  
  ```javascript
  // backend/src/server.js
  const Sentry = require('@sentry/node');
  
  Sentry.init({
    dsn: 'votre_dsn_sentry',
    environment: process.env.NODE_ENV,
  });
  ```

- [ ] **Ajouter un endpoint /health pour monitoring**
  ```javascript
  // backend/src/routes/health.js
  router.get('/health', async (req, res) => {
    try {
      // Vérifier connexion DB
      await pool.query('SELECT 1');
      res.json({ 
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'unhealthy',
        error: error.message 
      });
    }
  });
  ```

- [ ] **Configurer alertes pour erreurs critiques**

- [ ] **Mettre en place logs centralisés** (ELK, Datadog, etc.)

---

## 🚀 DÉPLOIEMENT

- [ ] **Créer un utilisateur système dédié**
  ```bash
  # Ne PAS exécuter l'application en tant que root
  sudo adduser --system --group gmao
  sudo chown -R gmao:gmao /opt/gmao
  ```

- [ ] **Configurer systemd pour auto-restart**
  ```bash
  # /etc/systemd/system/gmao-backend.service
  [Unit]
  Description=GMAO Backend
  After=network.target postgresql.service
  
  [Service]
  Type=simple
  User=gmao
  WorkingDirectory=/opt/gmao/backend
  ExecStart=/usr/bin/node src/server.js
  Restart=always
  RestartSec=10
  Environment=NODE_ENV=production
  
  [Install]
  WantedBy=multi-user.target
  
  # Activer
  sudo systemctl enable gmao-backend
  sudo systemctl start gmao-backend
  ```

- [ ] **Exécuter les migrations de base de données**
  ```bash
  cd backend
  npm run migrate
  ```

- [ ] **Construire le frontend pour production**
  ```bash
  cd frontend
  npm run build
  
  # Le dossier build/ contient les fichiers statiques à servir
  ```

- [ ] **Configurer le pare-feu**
  ```bash
  # UFW (Ubuntu)
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 22/tcp
  sudo ufw enable
  
  # NE PAS exposer directement PostgreSQL (5432) à Internet
  ```

---

## 🧪 TESTS AVANT MISE EN LIGNE

- [ ] **Tester l'authentification**
  ```bash
  curl -X POST https://votre-domaine.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@gmao.com","password":"votre_nouveau_password"}'
  ```

- [ ] **Vérifier les endpoints principaux**
  - [ ] GET /api/sites
  - [ ] GET /api/actifs
  - [ ] GET /api/ordres-travail
  - [ ] GET /api/dashboard/stats

- [ ] **Tester l'upload de fichiers**

- [ ] **Vérifier le rate limiting**
  ```bash
  # Essayer 10 requêtes rapides
  for i in {1..10}; do curl https://votre-domaine.com/api/sites; done
  ```

- [ ] **Valider HTTPS**
  ```bash
  # Vérifier le certificat SSL
  openssl s_client -connect votre-domaine.com:443 -servername votre-domaine.com
  ```

- [ ] **Tester depuis différents navigateurs**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

---

## 📈 PERFORMANCE

- [ ] **Activer la compression gzip**
  ```javascript
  // backend/src/server.js
  const compression = require('compression');
  app.use(compression());
  ```

- [ ] **Configurer le cache navigateur**
  ```nginx
  # nginx
  location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
  }
  ```

- [ ] **Optimiser les images** (compression, WebP)

- [ ] **Minifier CSS/JS** (déjà fait par React build)

---

## 📝 DOCUMENTATION

- [ ] **Créer un guide utilisateur**

- [ ] **Documenter l'API avec Swagger**

- [ ] **Préparer un guide de dépannage**

- [ ] **Documenter la procédure de backup/restore**
  ```bash
  # Restore depuis un backup
  gunzip < /var/backups/gmao/gmao_backup_20260122.sql.gz | psql -U postgres gmao_db
  ```

---

## 🔄 MAINTENANCE

- [ ] **Planifier les mises à jour de sécurité**
  ```bash
  # Vérifier les vulnérabilités
  cd backend && npm audit
  cd frontend && npm audit
  
  # Mettre à jour les packages
  npm update
  ```

- [ ] **Configurer rotation des logs**
  ```bash
  # /etc/logrotate.d/gmao
  /var/log/gmao/*.log {
      daily
      rotate 30
      compress
      delaycompress
      notifempty
      create 0640 gmao gmao
      sharedscripts
  }
  ```

- [ ] **Planifier les tests de restauration** (mensuel)

- [ ] **Documenter la procédure de rollback**

---

## 📞 SUPPORT

- [ ] **Créer une adresse email support** (support@votre-domaine.com)

- [ ] **Mettre en place un système de tickets** (optionnel)

- [ ] **Former les administrateurs système**

- [ ] **Créer une documentation d'incident**

---

## ✅ VALIDATION FINALE

- [ ] Tous les points de sécurité sont validés
- [ ] L'application fonctionne en HTTPS
- [ ] Les sauvegardes sont configurées
- [ ] Le monitoring est en place
- [ ] Les logs sont accessibles
- [ ] Les tests de charge sont satisfaisants
- [ ] La documentation est à jour
- [ ] L'équipe est formée

---

## 🎯 GO / NO GO

**Date de mise en production prévue**: ___/___/______

**Validation par**:
- [ ] Responsable technique: ________________
- [ ] Responsable sécurité: ________________
- [ ] Chef de projet: ________________

**Décision finale**: ⬜ GO  ⬜ NO GO

**Raison si NO GO**: _________________________________

---

**Note**: Cette checklist est un guide. Adaptez-la à vos besoins spécifiques.

**Documentation complète**: Voir [AUDIT_CODE_PROJET.md](./AUDIT_CODE_PROJET.md)
