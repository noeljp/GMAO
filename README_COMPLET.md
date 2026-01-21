# 🏭 GMAO - Gestion de Maintenance Assistée par Ordinateur

Application complète de gestion de maintenance industrielle développée avec Node.js, Express, React et PostgreSQL.

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Documentation](#documentation)
- [Technologies](#technologies)

## 🎯 Vue d'ensemble

Cette application GMAO permet de gérer l'ensemble du cycle de vie de la maintenance industrielle :
- Gestion des sites et actifs
- Création et suivi des ordres de travail
- Gestion des demandes d'intervention
- Planification et calendrier
- Rapports et statistiques
- Notifications en temps réel
- Recherche full-text
- Gestion documentaire

## ✨ Fonctionnalités

### 🔐 Authentification & Sécurité
- Authentification JWT
- 5 rôles utilisateurs (Admin, Manager, Technicien, User, Viewer)
- 28 permissions granulaires
- Rate limiting (protection DDoS)
- Bcrypt (hash sécurisé des mots de passe)
- Audit trail complet

### 📊 Gestion des Actifs
- Hiérarchie Sites → Actifs
- Classification par type, criticité, statut
- Historique complet des interventions
- Documents associés (manuels, photos, certificats)
- Statistiques par actif

### 🔧 Ordres de Travail
- CRUD complet
- Workflow avec 16 transitions possibles
- Assignation aux techniciens
- Priorités (urgente, haute, moyenne, basse)
- Types (préventif, correctif, inspection, upgrade)
- Historique et commentaires
- Documents joints

### 📝 Demandes d'Intervention
- Création par tous les utilisateurs
- Workflow d'approbation
- Conversion en ordre de travail
- Suivi de l'état

### 📅 Planification
- Vue calendrier (jour/semaine/mois)
- Visualisation des ordres planifiés
- Couleurs par priorité
- Navigation intuitive

### 📈 Rapports & Statistiques
- Tableau de bord avec KPIs
- Rapports personnalisables par période
- Filtrage par site
- Top 5 actifs/techniciens
- Taux de complétion
- Répartition par statut/priorité/type

### 🔔 Notifications
- Badge temps réel (refresh 30s)
- Notifications contextuelles
- Marquer comme lu
- Navigation vers entités liées

### 🔍 Recherche
- Full-text search (PostgreSQL ts_vector)
- Recherche dans actifs, ordres, demandes, documents
- Résultats groupés par type

### 📁 Gestion Documentaire
- Upload de fichiers (10MB max)
- Classification par type
- Téléchargement sécurisé
- Association aux entités

## 🏗️ Architecture

### Backend (Node.js + Express)
```
backend/
├── src/
│   ├── server.js                 # Point d'entrée
│   ├── config/                   # Configuration
│   │   ├── database.js           # Pool PostgreSQL
│   │   ├── logger.js             # Winston
│   │   ├── permissions.js        # RBAC
│   │   ├── workflow.js           # Machine à états
│   │   ├── audit.js              # Audit trail
│   │   └── upload.js             # Multer
│   ├── middleware/               # Middlewares
│   │   ├── auth.middleware.js    # JWT verification
│   │   └── error.middleware.js   # Error handling
│   ├── routes/                   # 10 fichiers de routes
│   │   ├── auth.routes.js        # Authentification
│   │   ├── users.routes.js       # Utilisateurs
│   │   ├── sites.routes.js       # Sites
│   │   ├── actifs.routes.js      # Actifs
│   │   ├── ordresTravail.routes.js # Ordres de travail
│   │   ├── demandes.routes.js    # Demandes
│   │   ├── dashboard.routes.js   # Dashboard
│   │   ├── documents.routes.js   # Documents
│   │   ├── search.routes.js      # Recherche
│   │   └── notifications.routes.js # Notifications
│   └── database/
│       ├── schema.sql             # 30 tables
│       ├── seed.sql               # Données de test
│       └── migrate.js             # Migration script
├── tests/                        # Tests unitaires
├── uploads/                      # Fichiers uploadés
└── logs/                         # Logs Winston
```

### Frontend (React + Material-UI)
```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.js             # Navigation + AppBar
│   │   └── NotificationCenter.js # Badge + Dropdown
│   ├── context/
│   │   └── AuthContext.js        # State global auth
│   ├── pages/                    # 15 pages
│   │   ├── Login.js
│   │   ├── Dashboard.js
│   │   ├── Sites.js
│   │   ├── Actifs.js
│   │   ├── ActifDetail.js
│   │   ├── OrdresTravail.js
│   │   ├── OrdreDetail.js
│   │   ├── Demandes.js
│   │   ├── DemandeDetail.js
│   │   ├── Users.js
│   │   ├── Search.js
│   │   ├── Documents.js
│   │   ├── Notifications.js
│   │   ├── Planification.js
│   │   └── Rapports.js
│   ├── App.js                    # Routes + Theme
│   ├── index.js
│   └── setupProxy.js             # Proxy backend
└── public/
    └── index.html
```

### Base de Données (PostgreSQL)
- **30 tables** avec relations complètes
- **50+ foreign keys** pour intégrité
- **Full-text search** avec ts_vector
- **Soft deletes** (is_active)
- **Timestamps** automatiques
- **UUIDs** pour clés primaires

#### Tables principales :
- users, roles, permissions, role_permissions
- sites, actifs, actif_types, criticites
- ordres_travail, demandes, workflows, workflow_transitions
- documents, notifications, audit_log
- pieces_detachees, stocks, contrats, fournisseurs
- preventifs, interventions, rapports

## 🚀 Installation

### Prérequis
- Docker Desktop
- Git

### Installation Rapide (Docker)

1. **Cloner le projet**
```bash
git clone <repository_url>
cd GMAO
```

2. **Lancer avec Docker Compose**
```bash
docker compose up -d
```

3. **Accéder à l'application**
- Frontend : http://localhost:3000
- Backend API : http://localhost:5000

4. **Connexion par défaut**
- Email : `admin@gmao.com`
- Mot de passe : `Admin123!`

### Installation Manuelle

Voir [INSTALLATION_COMPLET.md](INSTALLATION_COMPLET.md) pour :
- Installation sur Windows 11
- Installation sur AlmaLinux
- Configuration PostgreSQL
- Troubleshooting

## 📖 Utilisation

### Premier démarrage

1. **Connexion** avec le compte admin
2. **Créer un site** : Menu Sites → Nouvelle site
3. **Ajouter des actifs** : Menu Actifs → Nouvel actif
4. **Créer un ordre de travail** : Menu Ordres de travail → Nouvel ordre
5. **Visualiser le tableau de bord** : Statistiques en temps réel

### Workflow typique

```
Demande d'intervention
    ↓
Validation par manager
    ↓
Création ordre de travail
    ↓
Assignation technicien
    ↓
Exécution (transitions workflow)
    ↓
Clôture avec rapport
    ↓
Historique et statistiques
```

### Navigation

- **Lignes cliquables** sur toutes les listes
- **Navigation contextuelle** entre entités liées
- **Breadcrumb** automatique
- **Recherche globale** (Ctrl+K)
- **Notifications** en temps réel

## 📚 Documentation

- [README.md](README.md) - Ce fichier
- [INSTALLATION_COMPLET.md](INSTALLATION_COMPLET.md) - Guide d'installation détaillé
- [RAPPORT_FRONTEND_FINAL.md](RAPPORT_FRONTEND_FINAL.md) - Documentation frontend complète
- [VERIFICATION_FINALE.md](VERIFICATION_FINALE.md) - Tests et vérifications
- [ETAT_SECURITE.md](ETAT_SECURITE.md) - Audit sécurité (90/100)
- [BONNES_PRATIQUES.md](BONNES_PRATIQUES.md) - Guidelines de développement
- [FIX_PROXY.md](FIX_PROXY.md) - Résolution problèmes proxy Docker

### Documentation technique
- [Les Tables de base.md](Les%20Tables%20de%20base.md) - Structure base de données
- [proposition de schéma relation.md](proposition%20de%20schéma%20relation.md) - Diagrammes ER
- [Enum et tables d'historisation communes.md](Enum%20et%20tables%20d'historisation%20communes.md) - Énumérations

## 🛠️ Technologies

### Backend
- **Runtime** : Node.js 18
- **Framework** : Express 4.18.0
- **Database** : PostgreSQL 15
- **ORM** : pg (driver natif + pool)
- **Auth** : JWT (jsonwebtoken 9.0.2)
- **Password** : bcryptjs 2.4.3
- **Validation** : express-validator 7.0.1
- **Security** : helmet 7.1.0, cors 2.8.5
- **Rate Limiting** : express-rate-limit 7.1.5
- **File Upload** : multer 1.4.5
- **Logging** : winston 3.11.0

### Frontend
- **Library** : React 18.2.0
- **Router** : react-router-dom 6.20.1
- **UI Framework** : Material-UI 5.15.0
- **HTTP Client** : axios 1.6.2
- **State Management** : React Query 3.39.3
- **Date** : date-fns 2.30.0
- **Proxy** : http-proxy-middleware 2.0.6

### DevOps
- **Container** : Docker + Docker Compose
- **Database** : postgres:15-alpine
- **Reverse Proxy** : Intégré (setupProxy.js)

### Base de Données
- **PostgreSQL 15** avec extensions :
  - uuid-ossp (génération UUIDs)
  - pg_trgm (recherche similarité)
  - Full-text search (ts_vector, ts_query)

## 📊 Statistiques du Projet

- **50 endpoints** backend
- **30 tables** PostgreSQL
- **50+ relations** (foreign keys)
- **15 pages** frontend
- **28 permissions** RBAC
- **16 transitions** workflow
- **5 rôles** utilisateurs
- **7 types** de documents
- **90/100** score sécurité

## 🔒 Sécurité

- ✅ Authentification JWT (24h expiry)
- ✅ Bcrypt hashing (10 rounds)
- ✅ Rate limiting (5 auth/15min, 100 global/15min)
- ✅ Helmet (headers sécurisés)
- ✅ CORS configuré
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection
- ✅ CSRF protection
- ✅ File upload validation
- ✅ Audit trail complet

Voir [ETAT_SECURITE.md](ETAT_SECURITE.md) pour l'audit complet.

## 🧪 Tests

### Backend
```bash
cd backend
npm test
```

Tests disponibles :
- `tests/auth.test.js` - Authentification
- `tests/permissions.test.js` - RBAC
- `tests/sites.test.js` - Sites CRUD
- `tests/workflow.test.js` - Transitions

### Scripts de test
- `test-api.sh` - Test des endpoints
- `test-securite.sh` - Test sécurité

## 🐛 Troubleshooting

### Erreur de proxy
```
Error: ECONNREFUSED localhost:5000
```
**Solution** : Remplacer `localhost:5000` par `backend:5000` dans `setupProxy.js`

### Erreur 401 Unauthorized
**Causes** :
- Token JWT expiré (durée : 24h)
- Token manquant dans headers

**Solution** : Se reconnecter

### Erreur 400 sur création actif
**Cause** : Champ `type_id` manquant

**Solution** : Sélectionner un type d'actif dans le formulaire

### Base de données non initialisée
```bash
docker compose exec postgres psql -U gmao_user -d gmao_db -f /docker-entrypoint-initdb.d/schema.sql
docker compose exec postgres psql -U gmao_user -d gmao_db -f /docker-entrypoint-initdb.d/seed.sql
```

## 🚀 Déploiement

### Variables d'environnement

Backend (.env) :
```
DB_HOST=postgres
DB_PORT=5432
DB_USER=gmao_user
DB_PASSWORD=gmao_pass
DB_NAME=gmao_db
JWT_SECRET=votre_secret_unique_ici
NODE_ENV=production
PORT=5000
```

Frontend (.env) :
```
REACT_APP_API_URL=http://backend:5000
```

### Production

1. **Build images**
```bash
docker compose build
```

2. **Lancer en mode production**
```bash
docker compose -f docker-compose.prod.yml up -d
```

3. **Configurer reverse proxy** (Nginx/Traefik)

4. **SSL/TLS** avec Let's Encrypt

## 📝 Roadmap

### Phase 1 (Terminée) ✅
- Backend complet avec 50 endpoints
- Frontend avec 15 pages
- Authentification JWT
- RBAC avec 5 rôles
- Workflow avec transitions
- Recherche full-text
- Gestion documentaire

### Phase 2 (Suggérée)
- [ ] Tests E2E (Cypress)
- [ ] Export PDF/CSV
- [ ] API REST documentation (Swagger)
- [ ] Notifications email
- [ ] Mobile app (React Native)
- [ ] Intégration IoT (capteurs)
- [ ] Machine learning (prédiction pannes)

## 👥 Contributeurs

Développé par l'équipe GMAO

## 📄 Licence

Ce projet est sous licence MIT.

## 📞 Support

Pour toute question ou problème :
- Consulter la documentation dans le dossier /docs
- Ouvrir une issue GitHub
- Contacter l'équipe de support

---

**Version** : 2.0.0  
**Date** : ${new Date().toLocaleDateString('fr-FR')}  
**Status** : ✅ Production Ready
