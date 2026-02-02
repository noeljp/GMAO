# Installation et démarrage

## Prérequis
- Docker et Docker Compose installés
- Node.js 18+ (pour développement local)
- PostgreSQL 15+ (pour développement local)

## 🚀 Démarrage rapide avec Docker (Recommandé)

**Note:** Utilisez le script d'installation automatique `setup.sh` (Linux/Mac) ou `install_and_run.bat` (Windows) pour une installation guidée.

### Installation manuelle avec Docker :

1. Copier et configurer le fichier d'environnement :
```bash
cp .env.example .env
# Optionnel : Générer des mots de passe sécurisés
# POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
# Mettre à jour POSTGRES_PASSWORD et DB_PASSWORD dans .env
```

**⚠️ Important :** Ne créez PAS de fichier `backend/.env` lors de l'utilisation de Docker. 
Les variables d'environnement sont gérées par le fichier `.env` à la racine et Docker Compose.

2. Démarrer tous les services :
```bash
docker-compose up -d
```

3. Attendre que les services démarrent (environ 30 secondes)

4. Initialiser la base de données :
```bash
docker-compose exec backend npm run migrate
```

5. Accéder à l'application :
- Frontend : http://localhost:3010
- Backend API : http://localhost:5010
- API Health Check : http://localhost:5010/health
- Base de données : localhost:5432

## 🔐 Identifiants par défaut

Email : admin@gmao.com  
Mot de passe : Admin123!

⚠️ **Changez ces identifiants immédiatement après la première connexion !**

## 💻 Installation locale (Développement sans Docker)

**Note:** Cette section est pour le développement local SANS Docker. Si vous utilisez Docker, consultez la section ci-dessus.

### Backend

```bash
cd backend
npm install
cp .env.example .env

# ⚠️ IMPORTANT : Éditer .env et changer :
#   DB_HOST=localhost (au lieu de postgres)
#   CORS_ORIGIN=http://localhost:3000 (au lieu de 3010)

# Créer la base de données PostgreSQL locale
createdb gmao_db

# Exécuter les migrations
npm run migrate

# Démarrer le serveur
npm run dev
```

Le serveur démarre sur http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm start
```

L'interface démarre sur http://localhost:3000

## 🧪 Tester les améliorations de sécurité

```bash
# Lancer le script de test
./test-securite.sh
```

Ce script teste :
- Validation des entrées
- Rate limiting
- Protection des routes
- Headers de sécurité

## 📊 Vérifier les logs

```bash
# Logs du backend
tail -f backend/logs/combined.log

# Logs d'erreurs uniquement
tail -f backend/logs/error.log

# Logs Docker
docker-compose logs -f backend
```

## 🔧 Commandes utiles

### Docker

```bash
# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down

# Redémarrer les services
docker-compose restart

# Supprimer les volumes (⚠️ supprime les données)
docker-compose down -v

# Reconstruire les images
docker-compose build

# Entrer dans le container backend
docker-compose exec backend sh
```

### Base de données

```bash
# Se connecter à PostgreSQL (Docker)
docker-compose exec postgres psql -U postgres -d gmao_db

# Se connecter à PostgreSQL (local)
psql -U postgres -d gmao_db

# Créer une sauvegarde
docker-compose exec postgres pg_dump -U postgres gmao_db > backup.sql

# Restaurer une sauvegarde
docker-compose exec -T postgres psql -U postgres gmao_db < backup.sql
```

### NPM

```bash
# Backend
cd backend
npm run dev      # Développement avec nodemon
npm start        # Production
npm run migrate  # Exécuter les migrations
npm test         # Lancer les tests

# Frontend
cd frontend
npm start        # Développement
npm run build    # Build de production
npm test         # Lancer les tests
```

## 🐛 Résolution de problèmes

**⚠️ Pour les erreurs courantes (comme "Cannot find module 'mqtt'"), consultez le guide de dépannage complet :**

👉 **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Solutions détaillées pour toutes les erreurs

**Script de correction rapide pour les erreurs de modules :**
```bash
# Linux / macOS
./fix-mqtt-dependencies.sh

# Windows
fix-mqtt-dependencies.bat
```

### Le serveur ne démarre pas

1. Vérifier que PostgreSQL est démarré :
```bash
docker-compose ps
```

2. Vérifier les logs :
```bash
docker-compose logs backend
```

3. Vérifier le fichier `.env` à la racine du projet :
```bash
cat .env
# Assurez-vous que POSTGRES_PASSWORD et DB_PASSWORD sont identiques
```

### Erreur "Cannot connect to database"

1. Attendre que PostgreSQL soit complètement démarré (30s)
2. Vérifier que POSTGRES_PASSWORD et DB_PASSWORD sont identiques dans le fichier `.env` à la racine
3. Vérifier qu'il n'y a PAS de fichier `backend/.env` (qui pourrait interférer avec Docker Compose)
4. Redémarrer le service backend :
```bash
docker-compose restart backend
```

### Erreur "Module not found" ou "Cannot find module 'mqtt'"

Cette erreur indique que les dépendances Node.js ne sont pas correctement installées dans le conteneur.

**Solution rapide :**
```bash
# Linux / macOS
./fix-mqtt-dependencies.sh

# Windows
fix-mqtt-dependencies.bat
```

**Ou manuellement :**
```bash
# Reconstruire les conteneurs
docker-compose down
docker volume rm gmao_backend_node_modules
docker-compose build --no-cache backend
docker-compose up -d
```

Voir **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** pour plus de détails.

### Rate limiting bloque toutes les requêtes

- Attendre 15 minutes
- Ou redémarrer le serveur :
```bash
docker-compose restart backend
```

### Le frontend ne se connecte pas au backend

1. Vérifier que le backend est accessible :
```bash
curl http://localhost:5010/health
```

2. Pour Docker : Les ports doivent être 3010 (frontend) et 5010 (backend)
3. Pour développement local : Les ports sont 3000 (frontend) et 5000 (backend)

## 📚 Documentation

- [README.md](README.md) - Vue d'ensemble du projet
- [SECURITE.md](SECURITE.md) - Améliorations de sécurité
- [BONNES_PRATIQUES.md](BONNES_PRATIQUES.md) - Guide de développement
- [RESUME_AMELIORATIONS.md](RESUME_AMELIORATIONS.md) - Résumé des changements

## 🆘 Besoin d'aide ?

1. Consulter les logs : `backend/logs/error.log`
2. Vérifier la documentation ci-dessus
3. Ouvrir une issue sur le repository

## ✅ Checklist de vérification

Après l'installation avec Docker, vérifier que :

- [ ] Le serveur backend répond sur http://localhost:5010/health
- [ ] Le frontend s'affiche sur http://localhost:3010
- [ ] La connexion avec admin@gmao.com / Admin123! fonctionne
- [ ] Les logs sont créés dans les containers Docker
- [ ] Le rate limiting fonctionne (test-securite.sh)
- [ ] La validation des formulaires fonctionne

Si tout est ✅, l'installation est réussie ! 🎉
