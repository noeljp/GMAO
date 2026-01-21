# 🔧 Résolution du Problème de Proxy Frontend

## ✅ Solutions Appliquées

### 1. Créé `frontend/src/setupProxy.js`
Configuration du proxy pour utiliser le nom du service Docker `backend` au lieu de `localhost`.

### 2. Mis à jour `frontend/package.json`
- Ajouté la dépendance `http-proxy-middleware`
- Supprimé la ligne `"proxy": "http://localhost:5000"` (obsolète)

### 3. Corrigé `docker-compose.yml`
- Changé `REACT_APP_API_URL=http://localhost:5000` → `http://backend:5000`
- Supprimé l'avertissement `version` obsolète

## 🚀 Comment Appliquer les Corrections

**Depuis PowerShell dans C:\Projects\GMAO :**

```powershell
# 1. Arrêter les conteneurs
docker compose down

# 2. Reconstruire le frontend avec les nouvelles dépendances
docker compose build frontend

# 3. Redémarrer tous les services
docker compose up -d

# 4. Vérifier les logs
docker compose logs -f frontend
```

## ✅ Vérification

Une fois redémarré, vous ne devriez plus voir l'erreur `ECONNREFUSED`.

**Tester :**

1. **Ouvrir le navigateur** : http://localhost:3000
2. **Essayer de se connecter** avec admin@gmao.com / Admin123!
3. **Vérifier les logs** : Plus d'erreurs proxy

```powershell
# Vérifier que tout fonctionne
docker compose ps

# Voir les logs frontend (sans erreur proxy)
docker compose logs frontend --tail 20
```

## 📝 Explication du Problème

### Avant (❌ Ne fonctionnait pas)
```
Frontend Container → localhost:5000 → ❌ Erreur (localhost = le conteneur frontend lui-même)
```

### Après (✅ Fonctionne)
```
Frontend Container → backend:5000 → ✅ OK (backend = nom du service Docker)
```

Dans Docker Compose, les services communiquent entre eux via leurs **noms de service**, pas via `localhost`.

## 💡 Développement Local (hors Docker)

Si vous développez sans Docker, le proxy utilisera automatiquement `http://localhost:5000` grâce à la variable d'environnement.

```bash
# Frontend local
cd frontend
npm install
REACT_APP_API_URL=http://localhost:5000 npm start
```
