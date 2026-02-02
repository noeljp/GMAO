# 🪟 Installation GMAO sur Windows 11

Guide rapide pour installer et lancer l'application GMAO sur Windows 11 avec le script automatique.

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

### 1. Docker Desktop pour Windows

**Télécharger :** https://www.docker.com/products/docker-desktop/

**Installation :**
1. Télécharger `Docker Desktop Installer.exe`
2. Exécuter l'installateur
3. Cocher **"Use WSL 2 instead of Hyper-V"** (recommandé)
4. Redémarrer Windows après l'installation

**Vérification :**
- Lancer Docker Desktop depuis le menu Démarrer
- Attendre que l'icône Docker dans la barre des tâches soit verte
- Ouvrir PowerShell ou cmd et exécuter :

```cmd
docker --version
docker compose version
```

### 2. Git pour Windows (optionnel)

**Télécharger :** https://git-scm.com/download/win

Si vous n'avez pas Git, vous pouvez télécharger le projet directement depuis GitHub.

---

## 🚀 Installation rapide avec le script automatique

### Étape 1 : Télécharger le projet

**Avec Git :**
```cmd
cd C:\
mkdir Projects
cd Projects
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

**Sans Git :**
1. Aller sur https://github.com/noeljp/GMAO
2. Cliquer sur **Code** → **Download ZIP**
3. Extraire le ZIP dans `C:\Projects\GMAO`
4. Ouvrir cmd ou PowerShell dans ce dossier

### Étape 2 : Lancer le script

**Double-cliquer sur `install_and_run.bat`**

OU depuis cmd/PowerShell :

```cmd
install_and_run.bat
```

### Étape 3 : Suivre les instructions

Le script va vous guider à travers les étapes suivantes :

1. **✅ Vérification des prérequis**
   - Vérifie que Docker est installé
   - Vérifie que Docker Desktop est en cours d'exécution
   - Vérifie Docker Compose

2. **🔐 Génération des mots de passe**
   - Crée automatiquement un fichier `.env`
   - Génère des mots de passe sécurisés pour PostgreSQL
   - Génère un secret JWT sécurisé

3. **⚙️ Configuration**
   - Vous demande si c'est pour la production ou le développement
   - Recommandé : choisir "N" pour le développement

4. **🐳 Démarrage des services**
   - Télécharge les images Docker nécessaires
   - Construit les conteneurs
   - Démarre PostgreSQL, Backend et Frontend

5. **⏳ Attente des services**
   - Attend que PostgreSQL soit prêt
   - Attend que le backend soit prêt

6. **🗄️ Initialisation de la base de données**
   - Exécute les migrations de base de données
   - Crée les tables nécessaires
   - Insère les données de test (utilisateur admin)

7. **✨ Finalisation**
   - Affiche les URLs d'accès
   - Affiche les identifiants par défaut
   - Propose d'ouvrir l'application dans le navigateur

---

## 🌐 Accéder à l'application

Après l'installation, l'application est accessible à :

- **Frontend (Interface utilisateur)** : http://localhost:3010
- **Backend (API)** : http://localhost:5010
- **Test API** : http://localhost:5010/health

### Identifiants par défaut

```
Email    : admin@gmao.com
Mot de passe : Admin123!
```

⚠️ **IMPORTANT** : Changez le mot de passe après la première connexion !

---

## 🔧 Commandes utiles

Une fois l'installation terminée, vous pouvez utiliser ces commandes :

### Voir les logs en temps réel
```cmd
docker compose logs -f
```

### Voir les logs d'un service spécifique
```cmd
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Arrêter l'application
```cmd
docker compose down
```

### Redémarrer l'application
```cmd
docker compose restart
```

### Voir l'état des conteneurs
```cmd
docker compose ps
```

### Relancer les migrations
```cmd
docker compose exec backend npm run migrate
```

### Accéder au conteneur backend
```cmd
docker compose exec backend sh
```

### Accéder à la base de données PostgreSQL
```cmd
docker compose exec postgres psql -U postgres -d gmao_db
```

---

## 🐛 Résolution des problèmes courants

### Erreur : "Docker is not running"

**Solution :**
1. Ouvrir Docker Desktop depuis le menu Démarrer
2. Attendre que l'icône soit verte dans la barre des tâches
3. Relancer le script

### Erreur : "Port already in use"

**Cause :** Un autre programme utilise les ports 3010, 5010 ou 5432.

**Solution :**
```cmd
# Voir quel programme utilise le port
netstat -ano | findstr :3010
netstat -ano | findstr :5010
netstat -ano | findstr :5432

# Arrêter le programme ou changer les ports dans docker-compose.yml
```

### Erreur : "PostgreSQL failed to start"

**Solution :**
```cmd
# Voir les logs PostgreSQL
docker compose logs postgres

# Redémarrer PostgreSQL
docker compose restart postgres

# Si le problème persiste, supprimer les volumes et recommencer
docker compose down -v
install_and_run.bat
```

### Erreur : "Backend health check timeout"

**Solution :**
Le script continue quand même. Vérifiez que le backend démarre :
```cmd
docker compose logs backend
```

Si nécessaire, exécutez manuellement la migration :
```cmd
docker compose exec backend npm run migrate
```

### L'application ne s'affiche pas

**Vérifications :**
1. Docker Desktop est vert ✅
2. Les conteneurs sont actifs :
   ```cmd
   docker compose ps
   ```
3. Le backend répond :
   ```cmd
   curl http://localhost:5010/health
   ```
4. Vider le cache du navigateur (Ctrl+Shift+Delete)
5. Essayer en navigation privée

---

## 📦 Mise à jour de l'application

Pour mettre à jour vers la dernière version :

```cmd
# Se placer dans le dossier du projet
cd C:\Projects\GMAO

# Arrêter les services
docker compose down

# Récupérer les dernières modifications
git pull

# Reconstruire et redémarrer
docker compose build
docker compose up -d

# Exécuter les nouvelles migrations
docker compose exec backend npm run migrate
```

---

## 🧹 Désinstallation complète

Pour supprimer complètement l'application :

```cmd
# Se placer dans le dossier du projet
cd C:\Projects\GMAO

# Arrêter et supprimer les conteneurs et volumes
docker compose down -v

# Supprimer les images Docker (optionnel)
docker image rm gmao-backend gmao-frontend

# Supprimer le dossier du projet
cd C:\Projects
rmdir /s /q GMAO
```

---

## 🆘 Besoin d'aide ?

Si vous rencontrez des problèmes :

1. Consultez la documentation détaillée : [INSTALLATION_COMPLET.md](./INSTALLATION_COMPLET.md)
2. Vérifiez les logs : `docker compose logs`
3. Ouvrez une issue sur GitHub : https://github.com/noeljp/GMAO/issues

---

## 📚 Documentation complémentaire

- [README.md](./README.md) - Vue d'ensemble du projet
- [INSTALLATION_COMPLET.md](./INSTALLATION_COMPLET.md) - Guide d'installation détaillé (Windows 11 et AlmaLinux 9)
- [INSTALLATION_FROM_SCRATCH.md](./INSTALLATION_FROM_SCRATCH.md) - Installation manuelle complète
- [SECURITE.md](./SECURITE.md) - Guide de sécurité
- [CHECKLIST_PRODUCTION.md](./CHECKLIST_PRODUCTION.md) - Déploiement en production

---

## ✅ Checklist de vérification post-installation

Après l'installation, vérifiez que :

- [ ] Docker Desktop est en cours d'exécution (icône verte)
- [ ] Les 3 conteneurs sont actifs : `docker compose ps`
- [ ] Le frontend s'affiche sur http://localhost:3010
- [ ] Le backend répond sur http://localhost:5010/health
- [ ] La connexion avec admin@gmao.com fonctionne
- [ ] Le mot de passe admin a été changé

Si tous les points sont ✅, l'installation est réussie ! 🎉

---

**Bon test de l'application GMAO !** 🚀
