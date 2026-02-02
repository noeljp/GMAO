# 📦 Guide d'Installation Complet - GMAO

**Système de Gestion de Maintenance Assistée par Ordinateur**

Ce guide couvre l'installation complète sur **Windows 11** et **AlmaLinux 9**.

---

## 📋 Table des matières

- [Prérequis Windows 11](#-prérequis-windows-11)
- [Prérequis AlmaLinux 9](#-prérequis-almalinux-9)
- [Installation de l'application](#-installation-de-lapplication)
- [Démarrage et vérification](#-démarrage-et-vérification)
- [Développement local](#-développement-local)
- [Dépannage](#-dépannage)

---

## 🪟 Prérequis Windows 11

### 1. WSL 2 (Windows Subsystem for Linux)

**Vérifier si WSL est installé :**
```powershell
wsl --version
```

**Si non installé, installer WSL 2 :**

Ouvrir **PowerShell en mode Administrateur** et exécuter :

```powershell
# Installer WSL avec Ubuntu
wsl --install

# Redémarrer Windows
shutdown /r /t 0
```

**Après le redémarrage, mettre à jour WSL :**
```powershell
# Mettre à jour vers la dernière version
wsl --update

# Définir WSL 2 comme version par défaut
wsl --set-default-version 2

# Vérifier
wsl --list --verbose
```

**Résultat attendu :**
```
  NAME      STATE           VERSION
* Ubuntu    Running         2
```

### 2. Docker Desktop pour Windows

**Télécharger et installer :**

1. Télécharger depuis : **https://www.docker.com/products/docker-desktop/**
2. Exécuter le fichier `Docker Desktop Installer.exe`
3. Dans l'assistant d'installation :
   - ✅ Cocher **"Use WSL 2 instead of Hyper-V"** (recommandé)
   - ✅ Cocher **"Add shortcut to desktop"**
4. Cliquer sur **"Ok"** puis **"Close and restart"**
5. Redémarrer Windows

**Configuration après installation :**

1. Lancer **Docker Desktop**
2. Accepter les conditions d'utilisation
3. Aller dans **Settings** (icône engrenage)
4. **General** :
   - ✅ **"Use the WSL 2 based engine"**
   - ✅ **"Start Docker Desktop when you log in"**
5. **Resources → WSL Integration** :
   - ✅ Activer l'intégration avec Ubuntu
6. Allouer les ressources minimales recommandées :
   - **CPU** : 2 cores
   - **Memory** : 4 GB (6 GB recommandé)
   - **Swap** : 1 GB
   - **Disk** : 20 GB
7. Cliquer sur **"Apply & Restart"**

**Vérifier l'installation :**

Ouvrir **PowerShell** ou **Windows Terminal** :

```powershell
docker --version
docker compose version
```

**Résultat attendu :**
```
Docker version 24.0.7, build afdd53b
Docker Compose version v2.23.3-desktop.2
```

### 3. Git pour Windows

**Télécharger et installer :**

1. URL : **https://git-scm.com/download/win**
2. Télécharger **"64-bit Git for Windows Setup"**
3. Exécuter l'installateur
4. Options recommandées :
   - ✅ **"Git Bash Here"**
   - ✅ **"Git GUI Here"**
   - Éditeur : **Visual Studio Code** (si installé)
   - PA   sudo ss -tulpn | egrep ':3000 |:3010 |:5010 ' || trueTH : **"Git from the command line and also from 3rd-party software"**
   - HTTPS : **"Use the OpenSSL library"**
   - Line endings : **"Checkout Windows-style, commit Unix-style"**
   - Terminal : **"Use Windows' default console window"**

**Vérifier :**
```powershell
git --version
```

**Résultat attendu :**
```
git version 2.43.0.windows.1
```

### 4. Node.js 18 LTS (optionnel - pour développement local)

**Télécharger et installer :**

1. URL : **https://nodejs.org/en/download/**
2. Télécharger **"Windows Installer (.msi)"** 64-bit
3. Exécuter l'installateur
4. Options :
   - ✅ **"Automatically install the necessary tools"**
   - Accepter tout le reste par défaut

**Vérifier :**
```powershell
node --version
npm --version
```

**Versions recommandées :**
```
v18.19.0 ou supérieur
npm 10.2.4 ou supérieur
```

### 5. Visual Studio Code (optionnel mais recommandé)

**Télécharger :**
- URL : **https://code.visualstudio.com/**

**Extensions recommandées :**
```
code --install-extension ms-azuretools.vscode-docker
code --install-extension ms-vscode-remote.remote-wsl
code --install-extension eamodio.gitlens
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
```

---

## 🐧 Prérequis AlmaLinux 9

### 1. Mettre à jour le système

```bash
# Se connecter en root ou utiliser sudo
sudo dnf update -y
sudo dnf upgrade -y

# Redémarrer si le kernel a été mis à jour
sudo reboot
```

### 2. Installer les outils de base

```bash
# Repository EPEL (Extra Packages for Enterprise Linux)
sudo dnf install -y epel-release

# Outils essentiels
sudo dnf install -y \
    git \
    curl \
    wget \
    vim \
    nano \
    net-tools \
    bind-utils \
    jq

# Outils de développement
sudo dnf groupinstall -y "Development Tools"
```

### 3. Installer Docker Engine

**Méthode 1 : Repository officiel Docker (Recommandé)**

```bash
# Supprimer les anciennes versions si présentes
sudo dnf remove -y docker \
    docker-client \
    docker-client-latest \
    docker-common \
    docker-latest \
    docker-latest-logrotate \
    docker-logrotate \
    docker-engine \
    podman \
    runc

# Ajouter le repository Docker
sudo dnf config-manager --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

# Installer Docker
sudo dnf install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
```

**Méthode 2 : Via dnf (CentOS Stream compatible)**

```bash
# Si la méthode 1 ne fonctionne pas
sudo dnf install -y docker docker-compose
```

**Démarrer et activer Docker :**

```bash
# Démarrer le service Docker
sudo systemctl start docker

# Activer au démarrage automatique
sudo systemctl enable docker

# Vérifier le statut
sudo systemctl status docker
```

**Ajouter l'utilisateur au groupe docker :**

```bash
# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Appliquer les changements sans déconnexion
newgrp docker

# Ou se déconnecter/reconnecter
# logout puis reconnexion SSH
```

**Vérifier l'installation :**

```bash
# Vérifier les versions
docker --version
docker compose version

# Tester Docker sans sudo
docker run hello-world
```

**Résultat attendu :**
```
Docker version 24.0.7, build afdd53b
Docker Compose version v2.23.3
```

### 4. Installer Git

```bash
# Installer Git
sudo dnf install -y git

# Configurer Git (remplacer par vos informations)
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"

# Vérifier
git --version
git config --list
```

### 5. Installer Node.js 18 (optionnel - développement local)

**Méthode 1 : Via NodeSource (Recommandé)**

```bash
# Télécharger et exécuter le script de configuration
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

# Installer Node.js et npm
sudo dnf install -y nodejs

# Vérifier l'installation :
```bash
docker --version
docker compose version

# Vérifier si une variable DOCKER_HOST forcée redirige vers Podman (socket rootless)
echo "DOCKER_HOST=$DOCKER_HOST"

# Si DOCKER_HOST pointe vers un socket Podman (ex. unix:///run/user/1000/podman/podman.sock)
# ou un autre endpoint non désiré, réinitialisez-le pour utiliser le socket Docker système :
unset DOCKER_HOST

# Si vous venez d'ajouter votre utilisateur au groupe 'docker', appliquez la membership
# sans vous déconnecter :
newgrp docker

# Tester Docker sans sudo
docker run hello-world
```
# Lister les versions disponibles
sudo dnf module list nodejs

# Activer et installer Node.js 18
sudo dnf module enable nodejs:18
sudo dnf module install nodejs:18/common

# Vérifier
node --version
npm --version
```

**Installer les outils de build (recommandé) :**

```bash
# Pour compiler les modules natifs npm
sudo dnf install -y gcc-c++ make python3
```

### 6. Configurer le pare-feu

**Si firewalld est actif :**

```bash
# Vérifier le statut
sudo systemctl status firewalld

# Ouvrir les ports nécessaires
sudo firewall-cmd --permanent --add-port=3010/tcp   # Frontend
sudo firewall-cmd --permanent --add-port=5010/tcp   # Backend API
sudo firewall-cmd --permanent --add-port=5432/tcp   # PostgreSQL (si accès externe nécessaire)

# Recharger la configuration
sudo firewall-cmd --reload

# Vérifier les ports ouverts
sudo firewall-cmd --list-ports
```

**Alternative : Ajouter une règle pour une zone spécifique :**

```bash
# Si vous voulez autoriser seulement un réseau local
sudo firewall-cmd --permanent --zone=public --add-rich-rule='
  rule family="ipv4"
  source address="192.168.1.0/24"
  port protocol="tcp" port="5000" accept'

sudo firewall-cmd --reload
```

### 7. Configurer SELinux (si nécessaire)

**Vérifier le mode SELinux :**

```bash
getenforce
```

**Si SELinux est en mode "Enforcing" :**

```bash
# Option 1 : Ajouter des règles SELinux pour Docker
sudo setsebool -P container_manage_cgroup on

# Option 2 : Mettre en mode permissif (uniquement pour développement)
sudo setenforce 0

# Pour rendre permanent (déconseillé en production)
sudo sed -i 's/^SELINUX=enforcing/SELINUX=permissive/' /etc/selinux/config
```

---

## 🚀 Installation de l'application

### Sur Windows 11

#### Méthode 1 : Installation automatique (Recommandée)

**1. Ouvrir Git Bash ou Windows Terminal (PowerShell ou cmd)**

```powershell
# Créer un dossier pour le projet
mkdir C:\Projects
cd C:\Projects

# Cloner le repository
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

**2. Vérifier que Docker Desktop est lancé**

- Chercher "Docker Desktop" dans le menu Démarrer
- Attendre que l'icône Docker dans la barre des tâches soit verte
- Si erreur, redémarrer Docker Desktop

**3. Lancer le script d'installation automatique**

```cmd
# Double-cliquer sur install_and_run.bat
# Ou exécuter depuis cmd/PowerShell :
install_and_run.bat
```

Le script va automatiquement :
- ✅ Vérifier les prérequis (Docker Desktop)
- ✅ Créer le fichier `.env` avec des mots de passe sécurisés
- ✅ Démarrer tous les services Docker
- ✅ Initialiser la base de données
- ✅ Afficher les URLs d'accès et les identifiants
- ✅ Proposer d'ouvrir l'application dans le navigateur

**Alternative avec WSL Ubuntu :**

```bash
# Ouvrir Ubuntu depuis le menu Démarrer
cd ~
mkdir projects
cd projects

# Cloner le repository
git clone https://github.com/noeljp/GMAO.git
cd GMAO

# Utiliser le script Linux
./setup.sh
```

#### Méthode 2 : Installation manuelle

**1-2. Même que la méthode automatique**

**3. Démarrer les conteneurs**

```powershell
# Depuis Git Bash ou PowerShell
docker compose up -d

# Avec WSL
cd ~/projects/GMAO
docker compose up -d
```

### Sur AlmaLinux 9

**1. Se connecter au serveur (SSH si distant)**

```bash
ssh user@votre-serveur-ip
```

**2. Cloner le repository**

```bash
# Créer un dossier pour le projet
mkdir -p ~/projects
cd ~/projects

# Cloner le repository
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

**Alternative avec HTTPS si pas de clé SSH :**

```bash
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

**3. Vérifier les permissions Docker**

```bash
# Tester Docker sans sudo
docker ps

# Si erreur "permission denied", appliquer les changements
newgrp docker
# Ou se déconnecter/reconnecter
```

**4. Démarrer les conteneurs**

```bash
cd ~/projects/GMAO
docker compose up -d
```

---

## ✅ Démarrage et vérification

### Commandes identiques pour Windows et Linux

**1. Vérifier le statut des conteneurs (attendre 30-45 secondes)**

```bash
docker compose ps
```

**Résultat attendu :**
```
NAME             IMAGE            STATUS          PORTS
gmao-postgres    postgres:15      Up (healthy)    0.0.0.0:5432->5432/tcp
gmao-backend     gmao-backend     Up              0.0.0.0:5000->5000/tcp
gmao-frontend    gmao-frontend    Up              0.0.0.0:3000->3000/tcp
```

**2. Initialiser la base de données**

```bash
# Créer les tables et insérer les données de test
docker compose exec backend npm run migrate
```

**Résultat attendu :**
```
Running database migrations...
✅ Schema created successfully
✅ Seed data inserted successfully
✅ Migrations completed successfully
```

**3. Vérifier les logs (optionnel)**

```bash
# Logs du backend
docker compose logs backend --tail 50

# Logs du frontend
docker compose logs frontend --tail 50

# Logs en temps réel
docker compose logs -f backend
```

**4. Tester l'API**

**Windows PowerShell :**
```powershell
# Health check
Invoke-RestMethod -Uri http://localhost:5000/health

# Login test
$body = @{
    email = "admin@gmao.com"
    password = "Admin123!"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login `
    -ContentType "application/json" -Body $body
```

**Linux / Git Bash :**
```bash
# Health check
curl http://localhost:5000/health

# Login test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmao.com","password":"Admin123!"}'
```

**Résultat attendu :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cd50efe5-5490-490d-bf95-5a8efea22c3d",
    "email": "admin@gmao.com",
    "prenom": "Admin",
    "nom": "System",
    "role": "admin"
  }
}
```

**5. Accéder aux applications web**

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend React** | http://localhost:3000 | admin@gmao.com / Admin123! |
| **Backend API** | http://localhost:5000 | Token JWT requis |
| **PostgreSQL** | localhost:5432 | postgres / postgres |

**6. Tester avec le script automatique (Linux/Git Bash uniquement)**

```bash
# Rendre le script exécutable
chmod +x test-api.sh

# Attendre 15 minutes si rate limit atteint, puis :
./test-api.sh
```

---

## 💻 Développement local

### Backend (sans Docker)

**1. Installer PostgreSQL localement**

**Windows :**
- Télécharger : https://www.postgresql.org/download/windows/
- Installer avec pgAdmin 4
- Créer la base `gmao_db`

**AlmaLinux :**
```bash
sudo dnf install -y postgresql15-server postgresql15
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**2. Configurer le backend**

```bash
cd backend
npm install

# Copier et éditer le fichier .env
cp .env.example .env
nano .env
```

**Contenu du .env :**
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gmao_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

**3. Initialiser la base de données**

```bash
# Créer les tables
npm run migrate
```

**4. Lancer le backend**

```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```

**Le serveur démarre sur** http://localhost:5000

### Frontend (sans Docker)

**1. Installer les dépendances**

```bash
cd frontend
npm install
```

**2. Configurer l'URL de l'API (optionnel)**

Créer un fichier `.env` :
```env
REACT_APP_API_URL=http://localhost:5000
```

**3. Lancer le frontend**

```bash
npm start
```

**L'application s'ouvre automatiquement sur** http://localhost:3000

---

## 🔧 Commandes utiles

### Gestion des conteneurs Docker

```bash
# Démarrer tous les services
docker compose up -d

# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes (⚠️ PERTE DE DONNÉES)
docker compose down -v

# Redémarrer un service spécifique
docker compose restart backend

# Voir les logs en temps réel
docker compose logs -f backend

# Voir les 100 dernières lignes de logs
docker compose logs backend --tail 100

# Reconstruire les images
docker compose build

# Reconstruire et redémarrer
docker compose up -d --build

# Arrêter un service spécifique
docker compose stop frontend

# Voir l'utilisation des ressources
docker stats
```

### Base de données PostgreSQL

```bash
# Se connecter à PostgreSQL
docker compose exec postgres psql -U postgres -d gmao_db

# Lister les tables
docker compose exec postgres psql -U postgres -d gmao_db -c "\dt"

# Voir le nombre d'enregistrements
docker compose exec postgres psql -U postgres -d gmao_db -c "SELECT COUNT(*) FROM utilisateurs;"

# Backup de la base de données
docker compose exec postgres pg_dump -U postgres gmao_db > backup_$(date +%Y%m%d).sql

# Restaurer un backup
docker compose exec -T postgres psql -U postgres -d gmao_db < backup_20260121.sql

# Réinitialiser complètement la base
docker compose exec backend npm run migrate
```

### Exécuter des commandes dans les conteneurs

```bash
# Ouvrir un shell dans le backend
docker compose exec backend sh

# Ouvrir un shell dans PostgreSQL
docker compose exec postgres bash

# Lancer les tests unitaires
docker compose exec backend npm test

# Vérifier les packages npm installés
docker compose exec backend npm list

# Mettre à jour les dépendances
docker compose exec backend npm update
```

---

## 🆘 Dépannage

### Windows 11

**❌ Problème : "WSL 2 installation is incomplete"**

**Solution :**
```powershell
# PowerShell Administrateur
wsl --update
wsl --install -d Ubuntu
wsl --set-default-version 2

# Redémarrer Windows
shutdown /r /t 0
```

**❌ Problème : "Docker Desktop starting..." bloqué**

**Solution :**
1. Vérifier que la virtualisation est activée dans le BIOS
2. Aller dans Paramètres Windows → Applications → Docker Desktop → Réinitialiser
3. Redémarrer Docker Desktop
4. Si ça ne fonctionne pas, désinstaller complètement et réinstaller

**❌ Problème : Port 5000 ou 3000 déjà utilisé**

**Solution :**
```powershell
# Trouver le processus qui utilise le port
netstat -ano | findstr :5000

# Tuer le processus (remplacer <PID> par le numéro trouvé)
taskkill /PID <PID> /F
```

**❌ Problème : "Error response from daemon: Conflict"**

**Solution :**
```powershell
# Supprimer les anciens conteneurs
docker compose down
docker system prune -a

# Redémarrer
docker compose up -d
```

### AlmaLinux 9

**❌ Problème : "permission denied" avec Docker**

**Solution :**
```bash
# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Appliquer immédiatement
newgrp docker

# Ou se déconnecter/reconnecter
exit
# Puis se reconnecter en SSH
```

**❌ Problème : "Cannot connect to the Docker daemon"**

**Solution :**
```bash
# Démarrer Docker
sudo systemctl start docker

# Vérifier le statut
sudo systemctl status docker

# Si erreur, voir les logs
sudo journalctl -u docker.service -n 50
```

**❌ Problème : Port déjà utilisé**

**Solution :**
```bash
# Trouver le processus
sudo ss -tulpn | grep :5000

# Ou avec netstat
sudo netstat -tulpn | grep :5000

# Tuer le processus
sudo kill -9 <PID>
```

**❌ Problème : Firewall bloque les connexions**

**Solution :**
```bash
# Vérifier le statut du firewall
sudo systemctl status firewalld

# Désactiver temporairement pour tester
sudo systemctl stop firewalld

# Si ça fonctionne, ouvrir les ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# Réactiver le firewall
sudo systemctl start firewalld
```

**❌ Problème : SELinux bloque Docker**

**Solution :**
```bash
# Vérifier le mode SELinux
getenforce

# Mettre en mode permissif temporairement
sudo setenforce 0

# Si ça résout le problème, configurer SELinux pour Docker
sudo setsebool -P container_manage_cgroup on

# Remettre en mode enforcing
sudo setenforce 1
```

### Problèmes communs (Windows et Linux)

**❌ Problème : "Cannot connect to database"**

**Solution :**
```bash
# Vérifier que PostgreSQL est démarré et healthy
docker compose ps

# Attendre le healthcheck
docker compose ps | grep healthy

# Voir les logs PostgreSQL
docker compose logs postgres

# Redémarrer PostgreSQL
docker compose restart postgres

# Attendre 30 secondes puis réessayer
```

**❌ Problème : "Rate limit exceeded" (429)**

**Solution :**
```bash
# Le rate limiting protège contre les attaques
# Attendre 15 minutes ou redémarrer le backend
docker compose restart backend

# Ou augmenter la limite dans backend/src/server.js
```

**❌ Problème : Backend ne démarre pas**

**Solution :**
```bash
# Voir les logs détaillés
docker compose logs backend

# Vérifier les variables d'environnement
docker compose exec backend env | grep DB_

# Reconstruire l'image backend
docker compose build backend
docker compose up -d backend

# Vérifier que PostgreSQL est accessible
docker compose exec backend ping postgres
```

**❌ Problème : Frontend affiche une erreur CORS**

**Solution :**
```bash
# Vérifier que le backend accepte les requêtes depuis localhost:3000
# Voir backend/src/server.js - configuration CORS

# Reconstruire le frontend
docker compose build frontend
docker compose up -d frontend
```

**❌ Problème : Migration échoue**

**Solution :**
```bash
# Réinitialiser complètement la base
docker compose down -v
docker compose up -d
sleep 30
docker compose exec backend npm run migrate
```

---

## 📊 Checklist de vérification

### Installation complète

- [ ] Docker installé et fonctionnel (`docker --version`)
- [ ] Docker Compose installé (`docker compose version`)
- [ ] Git installé (`git --version`)
- [ ] Repository cloné
- [ ] Conteneurs démarrés (`docker compose ps`)
- [ ] PostgreSQL en statut "healthy"
- [ ] Base de données initialisée (`npm run migrate`)
- [ ] Health check OK (`curl http://localhost:5000/health`)
- [ ] Login fonctionnel (admin@gmao.com / Admin123!)
- [ ] Frontend accessible sur http://localhost:3000
- [ ] Dashboard affiche des données

### Test API complet

```bash
# 1. Health check
curl http://localhost:5000/health

# 2. Login et récupération du token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmao.com","password":"Admin123!"}' | \
  jq -r '.token')

echo "Token: $TOKEN"

# 3. Lister les sites
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/sites | jq .

# 4. Créer un site
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/sites \
  -d '{"nom":"Site Test","code":"TEST","ville":"Paris","pays":"France"}' | jq .

# 5. Dashboard stats
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/dashboard/stats | jq .
```

---

## 📚 Documentation complémentaire

- [README.md](README.md) - Vue d'ensemble du projet
- [SECURITE.md](SECURITE.md) - Guide de sécurité et bonnes pratiques
- [BONNES_PRATIQUES.md](BONNES_PRATIQUES.md) - Standards de développement
- [RAPPORT_VERIFICATION.md](RAPPORT_VERIFICATION.md) - Rapport technique complet
- [VERIFICATION_FINALE.md](VERIFICATION_FINALE.md) - État du projet

---

## 🆘 Support et aide

### En cas de problème persistant

1. **Vérifier les logs :**
   ```bash
   docker compose logs
   ```

2. **Redémarrer proprement :**
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **Réinitialiser complètement (⚠️ perte de données) :**
   ```bash
   docker compose down -v
   docker compose up -d
   sleep 45
   docker compose exec backend npm run migrate
   ```

4. **Vérifier les ressources système :**
   ```bash
   # Linux
   free -h
   df -h
   
   # Windows (PowerShell)
   Get-ComputerInfo | Select-Object OsFreePhysicalMemory, OsTotalVisibleMemorySize
   ```

5. **Nettoyer Docker :**
   ```bash
   # Supprimer les conteneurs arrêtés
   docker container prune -f
   
   # Supprimer les images inutilisées
   docker image prune -a -f
   
   # Supprimer les volumes non utilisés
   docker volume prune -f
   
   # Tout nettoyer (⚠️ supprime TOUT sauf les volumes actifs)
   docker system prune -a -f
   ```

### Commandes de diagnostic

```bash
# Version de tous les composants
docker --version
docker compose version
git --version
node --version
npm --version

# État du système
docker compose ps
docker compose top
docker stats --no-stream

# Espace disque Docker
docker system df

# Informations réseau
docker network ls
docker network inspect gmao_default

# Logs complets
docker compose logs > logs_complets.txt
```

---

## 🎓 Ressources supplémentaires

### Windows 11
- **WSL 2** : https://learn.microsoft.com/fr-fr/windows/wsl/
- **Docker Desktop** : https://docs.docker.com/desktop/windows/
- **Git for Windows** : https://gitforwindows.org/

### AlmaLinux
- **Documentation AlmaLinux** : https://wiki.almalinux.org/
- **Docker on RHEL/CentOS** : https://docs.docker.com/engine/install/centos/
- **Firewalld** : https://firewalld.org/documentation/

### Général
- **Docker Documentation** : https://docs.docker.com/
- **Docker Compose** : https://docs.docker.com/compose/
- **Node.js** : https://nodejs.org/docs/
- **PostgreSQL** : https://www.postgresql.org/docs/

---

**Version** : 2.0.0  
**Date** : 21 janvier 2026  
**Testé sur** :
- Windows 11 23H2 (Build 22631)
- AlmaLinux 9.3 (Shamrock Pampas Cat)
- Docker Desktop 4.26.1
- Docker Engine 24.0.7
- Docker Compose v2.23.3

**Auteur** : GitHub Copilot  
**Support** : Documentation projet GMAO
