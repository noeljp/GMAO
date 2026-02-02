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

### Installation automatique (Recommandé)

#### Linux / macOS

```bash
# Cloner le repository
git clone https://github.com/noeljp/GMAO.git
cd GMAO

# Lancer le script d'installation
./setup.sh
```

#### Windows 11

```cmd
# Cloner le repository
git clone https://github.com/noeljp/GMAO.git
cd GMAO

# Lancer le script d'installation
install_and_run.bat
```

Le script va automatiquement :
- Vérifier les prérequis (Docker, Docker Compose)
- Créer le fichier `.env` avec des mots de passe sécurisés
- Démarrer tous les services
- Initialiser la base de données

### Installation manuelle

1. Cloner le repository :
```bash
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

2. Configurer l'environnement :
```bash
# Copier le fichier d'exemple et le personnaliser
cp .env.example .env
nano .env  # Modifier les mots de passe et secrets
```

3. Démarrer les services :
```bash
docker compose up -d
```

4. Initialiser la base de données :
```bash
docker compose exec backend npm run migrate
```

5. Accéder aux services :
- Frontend: http://localhost:3010
- Backend API: http://localhost:5010
- PostgreSQL: localhost:5432

### Prérequis

- Docker et Docker Compose
- Git (pour cloner le repository)
- 4 GB RAM minimum
- 10 GB espace disque

**Pour plus de détails**, voir [INSTALLATION_FROM_SCRATCH.md](./INSTALLATION_FROM_SCRATCH.md)

## 🔐 Connexion par défaut

- **Email**: admin@gmao.com
- **Mot de passe**: Admin123!

⚠️ **IMPORTANT** : Ces identifiants sont à usage de test uniquement. Changez-les immédiatement après la première connexion, surtout en production !

Pour changer le mot de passe admin :
1. Connectez-vous avec les identifiants par défaut
2. Accédez à votre profil (icône utilisateur)
3. Changez le mot de passe
4. Sauvegardez

En production, vous pouvez aussi générer un nouveau hash bcrypt et le mettre à jour directement dans la base de données.

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
├── backend/                  # API Node.js + Express
│   ├── src/
│   │   ├── config/          # Configuration (DB, logger, etc.)
│   │   ├── database/        # Migrations et seeds
│   │   ├── middleware/      # Middleware Express (auth, errors)
│   │   ├── routes/          # Routes API (12 modules)
│   │   ├── services/        # Services métier (IoT, AI, etc.)
│   │   └── server.js        # Point d'entrée
│   ├── tests/               # Tests unitaires
│   ├── Dockerfile           # Image Docker dev
│   ├── Dockerfile.prod      # Image Docker production
│   └── package.json
│
├── frontend/                # Application React
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── context/         # Context React (Auth)
│   │   ├── pages/           # Pages de l'application
│   │   ├── App.js
│   │   └── index.js
│   ├── Dockerfile           # Image Docker dev
│   ├── Dockerfile.prod      # Image Docker production
│   ├── nginx.conf           # Config nginx (prod)
│   └── package.json
│
├── .env.example             # Template variables d'environnement
├── docker-compose.yml       # Orchestration développement
├── docker-compose.prod.yml  # Orchestration production
├── setup.sh                 # Script d'installation automatique
├── INSTALLATION_FROM_SCRATCH.md  # Guide installation détaillé
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

### Variables d'environnement

Le projet utilise un fichier `.env` pour la configuration. Copiez `.env.example` et personnalisez :

```bash
cp .env.example .env
```

**Variables principales :**
- `POSTGRES_PASSWORD` : Mot de passe PostgreSQL (à changer !)
- `JWT_SECRET` : Clé secrète JWT (64+ caractères recommandés)
- `CORS_ORIGIN` : Origine autorisée pour CORS
- `NODE_ENV` : `development` ou `production`

⚠️ **En production** :
- Utilisez des mots de passe forts et uniques
- Générez un `JWT_SECRET` avec `openssl rand -hex 64`
- Configurez `CORS_ORIGIN` avec votre domaine
- Activez HTTPS avec un certificat SSL valide

Voir [CHECKLIST_PRODUCTION.md](./CHECKLIST_PRODUCTION.md) pour la checklist complète.

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Documentation de conception

- **[WINDOWS_INSTALLATION.md](./WINDOWS_INSTALLATION.md)** - 🪟 Guide d'installation rapide pour Windows 11
- **[INSTALLATION_FROM_SCRATCH.md](./INSTALLATION_FROM_SCRATCH.md)** - Guide d'installation complet et détaillé
- **[INSTALLATION_COMPLET.md](./INSTALLATION_COMPLET.md)** - Guide d'installation Windows 11 et AlmaLinux 9
- **[CHECKLIST_PRODUCTION.md](./CHECKLIST_PRODUCTION.md)** - Checklist de déploiement en production
- **[SECURITE.md](./SECURITE.md)** - Guide de sécurité et bonnes pratiques
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guide de contribution au projet
- [Les Tables de base.md](./Les%20Tables%20de%20base.md) - Description des tables
- [proposition de schéma relation.md](./proposition%20de%20schéma%20relation.md) - Schéma relationnel complet
- [liste structurée des machines d état.md](./liste%20structurée%20des%20machines%20d%20état%20%28workflows%29%20à%20prévoir%20dans%20une%20GMAO%20industrielle.md) - Workflows et machines d'état

## 📜 Licence

MIT

## 👥 Auteurs

Votre équipe de développement