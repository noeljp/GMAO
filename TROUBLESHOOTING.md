# Guide de dépannage GMAO

## Erreur : PostgreSQL Authentication Failed

### Symptômes
```
Error starting MQTT service: password authentication failed for user "postgres"
error: password authentication failed for user "postgres"
```

Cette erreur indique que l'application ne peut pas se connecter à PostgreSQL avec les identifiants configurés.

### Solution rapide

**Étape 1 : Vérifier que le fichier `.env` existe**
```bash
ls -la .env
```

**Étape 2 : Si le fichier n'existe pas, le créer**
```bash
cp .env.example .env
```

**Étape 3 : Vérifier que les mots de passe correspondent**
```bash
grep "PASSWORD" .env
# POSTGRES_PASSWORD et DB_PASSWORD doivent être identiques !
```

**Étape 4 : Supprimer le fichier backend/.env s'il existe (pour Docker)**
```bash
rm -f backend/.env
```

**Étape 5 : Redémarrer les services**
```bash
docker compose down
docker compose up -d
```

**📖 Pour plus de détails, consultez [TROUBLESHOOTING_POSTGRES_AUTH.md](./TROUBLESHOOTING_POSTGRES_AUTH.md)**

---

## Erreur : Cannot find module 'mqtt'

### Symptômes
```
Error: Cannot find module 'mqtt'
```

Cette erreur se produit lorsque les dépendances Node.js ne sont pas correctement installées dans le conteneur Docker.

### Solution 1 : Reconstruire les conteneurs (Recommandée)

```bash
# Arrêter et supprimer les conteneurs existants
docker-compose down

# Supprimer le volume node_modules (pour forcer la réinstallation)
docker volume rm gmao_backend_node_modules

# Reconstruire les images Docker
docker-compose build --no-cache

# Redémarrer les services
docker-compose up -d

# Initialiser la base de données si nécessaire
docker-compose exec backend npm run migrate
```

### Solution 2 : Réinstaller les dépendances manuellement

Si la solution 1 ne fonctionne pas, vous pouvez réinstaller les dépendances manuellement dans le conteneur :

```bash
# Se connecter au conteneur backend
docker-compose exec backend sh

# Dans le conteneur, réinstaller les dépendances
npm install

# Quitter le conteneur
exit

# Redémarrer le service backend
docker-compose restart backend
```

### Solution 3 : Nettoyer complètement et réinstaller

Si les solutions précédentes ne fonctionnent pas, effectuez un nettoyage complet :

```bash
# Arrêter tous les services
docker-compose down -v

# Supprimer toutes les images GMAO
docker images | grep gmao | awk '{print $3}' | xargs docker rmi -f

# Supprimer tous les volumes
docker volume ls | grep gmao | awk '{print $2}' | xargs docker volume rm

# Reconstruire et redémarrer
docker-compose build --no-cache
docker-compose up -d

# Initialiser la base de données
docker-compose exec backend npm run migrate
```

## Autres erreurs courantes

### Erreur : PostgreSQL connection refused

**Solution :**
```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps postgres

# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Attendre que PostgreSQL soit prêt
docker-compose exec postgres pg_isready -U postgres
```

### Erreur : Port already in use

**Solution :**
```bash
# Identifier le processus utilisant le port (ex: 5010 pour le backend)
lsof -i :5010  # Linux/macOS
netstat -ano | findstr :5010  # Windows

# Arrêter le processus ou changer le port dans docker-compose.yml
```

### Erreur : Cannot connect to Docker daemon

**Solution :**
```bash
# Vérifier que Docker est démarré
sudo systemctl status docker  # Linux
# ou ouvrir Docker Desktop sur Windows/macOS

# Démarrer Docker si nécessaire
sudo systemctl start docker  # Linux
```

## Logs et débogage

### Voir les logs en temps réel

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Vérifier l'état des services

```bash
# Statut des conteneurs
docker-compose ps

# Utilisation des ressources
docker stats
```

### Inspecter un conteneur

```bash
# Se connecter au conteneur
docker-compose exec backend sh

# Vérifier les variables d'environnement
docker-compose exec backend env

# Vérifier les fichiers installés
docker-compose exec backend ls -la /app/node_modules
```

## Besoin d'aide ?

Si vous rencontrez toujours des problèmes après avoir suivi ce guide :

1. Consultez la [documentation d'installation](INSTALLATION.md)
2. Vérifiez les [issues GitHub](https://github.com/noeljp/GMAO/issues)
3. Ouvrez une nouvelle issue avec :
   - Votre système d'exploitation
   - Les versions de Docker et Docker Compose
   - Les logs complets de l'erreur
   - Les étapes que vous avez suivies
