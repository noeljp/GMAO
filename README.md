# GMAO - Gestion de Maintenance Assistée par Ordinateur

Application complète de gestion de maintenance pour l'industrie.

## 🏗️ Architecture

- **Frontend**: React 18 + Material-UI
- **Backend**: Node.js + Express
- **Base de données**: PostgreSQL 15
- **Authentification**: JWT
- **Conteneurisation**: Docker & Docker Compose

## 📋 Fonctionnalités

- ✅ Gestion des sites et localisations
- ✅ Gestion des actifs (équipements/machines)
- ✅ Ordres de travail (maintenance préventive et corrective)
- ✅ Demandes d'intervention
- ✅ Gestion des utilisateurs et équipes
- ✅ Dashboard et statistiques
- ✅ Authentification sécurisée
- ✅ Rate limiting (protection brute force)
- ✅ Validation des entrées (express-validator)
- ✅ Pagination sur toutes les listes
- ✅ Système de logs structuré (Winston)
- ✅ Gestion d'erreurs centralisée

## 🚀 Démarrage rapide

### Prérequis

- Docker et Docker Compose
- Node.js 18+ (pour développement local)
- PostgreSQL 15+ (pour développement local)

### Installation avec Docker (Recommandé)

1. Cloner le repository :
```bash
git clone <repo-url>
cd GMAO
```

2. Démarrer tous les services :
```bash
docker-compose up -d
```

3. Accéder aux services :
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432

4. Initialiser la base de données (première fois) :
```bash
docker-compose exec backend npm run migrate
```

### Installation locale

#### Backend

```bash
cd backend
npm install
cp .env.example .env
# Éditer .env avec vos paramètres
npm run migrate  # Créer la base de données
npm run dev      # Démarrer le serveur
```

#### Frontend

```bash
cd frontend
npm install
npm start
```

## 🔐 Connexion par défaut

- **Email**: admin@gmao.com
- **Mot de passe**: admin123

⚠️ **IMPORTANT** : Changez ces identifiants immédiatement en production !

## 🔒 Sécurité

Le projet inclut plusieurs mesures de sécurité :
- Rate limiting (5 tentatives de connexion / 15min)
- Validation des entrées avec express-validator
- Hash bcrypt pour les mots de passe
- Helmet pour les headers HTTP sécurisés
- Pagination pour éviter les surcharges
- Logs structurés avec Winston
- Gestion d'erreurs centralisée

Voir [SECURITE.md](./SECURITE.md) pour plus de détails.

## 📁 Structure du projet

```
GMAO/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (DB, etc.)
│   │   ├── database/        # Migrations et seeds
│   │   ├── middleware/      # Middleware Express
│   │   ├── routes/          # Routes API
│   │   └── server.js        # Point d'entrée
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── context/         # Context React (Auth)
│   │   ├── pages/           # Pages de l'application
│   │   ├── App.js
│   │   └── index.js
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## 🛠️ API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription

### Sites
- `GET /api/sites` - Liste des sites
- `GET /api/sites/:id` - Détail d'un site
- `POST /api/sites` - Créer un site
- `PUT /api/sites/:id` - Modifier un site
- `DELETE /api/sites/:id` - Supprimer un site

### Actifs
- `GET /api/actifs` - Liste des actifs
- `GET /api/actifs/:id` - Détail d'un actif
- `POST /api/actifs` - Créer un actif

### Ordres de travail
- `GET /api/ordres-travail` - Liste des OT
- `GET /api/ordres-travail/:id` - Détail d'un OT
- `POST /api/ordres-travail` - Créer un OT
- `PATCH /api/ordres-travail/:id/status` - Changer le statut

### Demandes
- `GET /api/demandes` - Liste des demandes
- `POST /api/demandes` - Créer une demande

## 🗄️ Schéma de base de données

La base de données comprend :

- **Sites et structure** : sites, bâtiments, zones, localisations
- **Utilisateurs** : utilisateurs, équipes, rôles, permissions
- **Actifs** : actifs, types, fabricants, statuts, criticités
- **Maintenance** : demandes d'intervention, ordres de travail, interventions
- **Pièces détachées** : pièces, stocks
- **Tags** : système de tags flexible

Voir [proposition de schéma relation.md](./proposition%20de%20schéma%20relation.md) pour plus de détails.

## 📝 Scripts disponibles

### Backend
- `npm start` - Démarrer en production
- `npm run dev` - Démarrer en développement (nodemon)
- `npm run migrate` - Exécuter les migrations
- `npm test` - Lancer les tests

### Frontend
- `npm start` - Démarrer le serveur de développement
- `npm run build` - Build de production
- `npm test` - Lancer les tests

## 🔧 Configuration

### Variables d'environnement Backend (.env)

```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmao_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

⚠️ **En production** :
- Utilisez un `JWT_SECRET` fort et unique
- Restreignez `CORS_ORIGIN` à votre domaine
- Changez les credentials de la base de données

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Documentation de conception

- [Les Tables de base.md](./Les%20Tables%20de%20base.md) - Description des tables
- [proposition de schéma relation.md](./proposition%20de%20schéma%20relation.md) - Schéma relationnel complet
- [liste structurée des machines d état.md](./liste%20structurée%20des%20machines%20d%20état%20%28workflows%29%20à%20prévoir%20dans%20une%20GMAO%20industrielle.md) - Workflows et machines d'état

## 📜 Licence

MIT

## 👥 Auteurs

Votre équipe de développement