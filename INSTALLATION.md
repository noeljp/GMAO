# Installation et démarrage

## Prérequis
- Docker et Docker Compose installés
- Node.js 18+ (pour développement local)
- PostgreSQL 15+ (pour développement local)

## 🚀 Démarrage rapide avec Docker (Recommandé)

1. Copier le fichier d'environnement backend :
```bash
cp backend/.env.example backend/.env
```

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
- Frontend : http://localhost:3000
- Backend API : http://localhost:5000
- Base de données : localhost:5432

## 🔐 Identifiants par défaut

Email : admin@gmao.com  
Mot de passe : admin123

⚠️ **Changez ces identifiants immédiatement après la première connexion !**

## 💻 Installation locale (Développement)

### Backend

```bash
cd backend
npm install
cp .env.example .env

# Éditer .env avec vos paramètres de base de données

# Créer la base de données
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

### Le serveur ne démarre pas

1. Vérifier que PostgreSQL est démarré :
```bash
docker-compose ps
```

2. Vérifier les logs :
```bash
docker-compose logs backend
```

3. Vérifier le fichier `.env` :
```bash
cat backend/.env
```

### Erreur "Cannot connect to database"

1. Attendre que PostgreSQL soit complètement démarré (30s)
2. Vérifier les credentials dans `.env`
3. Redémarrer le service backend :
```bash
docker-compose restart backend
```

### Erreur "Module not found"

```bash
# Réinstaller les dépendances
cd backend && npm install
cd ../frontend && npm install
```

### Rate limiting bloque toutes les requêtes

- Attendre 15 minutes
- Ou redémarrer le serveur :
```bash
docker-compose restart backend
```

### Le frontend ne se connecte pas au backend

1. Vérifier que le backend est accessible :
```bash
curl http://localhost:5000/health
```

2. Vérifier CORS dans `backend/.env` :
```
CORS_ORIGIN=http://localhost:3000
```

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

Après l'installation, vérifier que :

- [ ] Le serveur backend répond sur http://localhost:5000/health
- [ ] Le frontend s'affiche sur http://localhost:3000
- [ ] La connexion avec admin@gmao.com fonctionne
- [ ] Les logs sont créés dans `backend/logs/`
- [ ] Le rate limiting fonctionne (test-securite.sh)
- [ ] La validation des formulaires fonctionne

Si tout est ✅, l'installation est réussie ! 🎉
