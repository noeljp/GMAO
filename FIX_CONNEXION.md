# 🔧 Solution : Problème de connexion "Email ou mot de passe incorrect"

## ✅ État actuel

- **Backend** : ✅ Fonctionne (testé via API)
- **Mot de passe** : ✅ Réinitialisé et fonctionne
- **Services** : ✅ Tous UP

```bash
Email : admin@gmao.com
Mot de passe : Admin123!
```

## 🎯 Solution : Vider le cache du navigateur

Le problème vient du **cache du navigateur** qui conserve les anciennes données d'authentification.

### Étape 1 : Vider le cache

**Option A - Hard Refresh (recommandé) :**
1. Ouvrez **http://localhost:3010** (pas 3000, pas 5010)
2. Appuyez sur **Ctrl + Shift + R** (Windows/Linux)
   ou **Cmd + Shift + R** (Mac)
3. Cela force le rechargement sans cache

**Option B - Vider complètement le stockage :**
1. Ouvrez **http://localhost:3010**
2. Appuyez sur **F12** (ouvrir DevTools)
3. Onglet **Application** (ou **Stockage** en français)
4. Cliquez sur **Clear storage** (Effacer le stockage)
5. Cliquez sur **Clear site data** (Effacer les données du site)
6. Rechargez la page (**F5**)

**Option C - Mode navigation privée :**
1. Ouvrez une fenêtre de navigation privée
2. Allez sur **http://localhost:3010**
3. Connectez-vous

### Étape 2 : Se connecter

1. URL : **http://localhost:3010** ⚠️ **Important : utilisez le port 3010**
2. Email : **admin@gmao.com**
3. Mot de passe : **Admin123!**
4. Cliquez sur **Se connecter**

## 🚨 Erreurs possibles

### "Rate limit exceeded" (429)
Si trop de tentatives échouées :
```bash
# Redémarrer le backend
docker compose restart backend

# Attendre 30 secondes puis réessayer
```

### Les services ne répondent pas
```bash
# Redémarrer tous les services
docker compose restart

# Attendre 30 secondes
sleep 30

# Vérifier l'état
docker compose ps
```

### Le frontend ne charge pas
```bash
# Voir les logs
docker compose logs frontend --tail 20

# Si erreur, reconstruire
docker compose build frontend
docker compose up -d frontend
```

## 📊 Vérification de l'état

### Vérifier que les services fonctionnent :
```bash
# État des conteneurs
docker compose ps

# Résultat attendu : tous "Up"
# gmao-backend    Up    0.0.0.0:5010->5000/tcp
# gmao-frontend   Up    0.0.0.0:3010->3000/tcp
# gmao-postgres   Up    0.0.0.0:5432->5432/tcp
```

### Tester l'API directement :
```bash
# Exécuter le script de test
./test-login.sh

# Doit afficher : ✅ CONNEXION RÉUSSIE!
```

## 🔍 Diagnostic avancé

Si le problème persiste après avoir vidé le cache :

### 1. Vérifier que vous utilisez la bonne URL
- ✅ **http://localhost:3010** ← BON
- ❌ http://localhost:3000 ← Port interne Docker
- ❌ http://localhost:5010 ← API backend seulement

### 2. Ouvrir la console navigateur (F12)
Recherchez les erreurs en rouge :
- Erreur 429 → Rate limit (voir solution ci-dessus)
- Erreur 401 → Mot de passe incorrect (vider le cache)
- Erreur 500 → Problème backend (voir logs : `docker compose logs backend`)
- Erreur de connexion → Services down (voir `docker compose ps`)

### 3. Vérifier les logs en temps réel
```bash
# Terminal 1 : logs backend
docker compose logs -f backend

# Terminal 2 : logs frontend
docker compose logs -f frontend

# Puis essayez de vous connecter et observez les logs
```

## 🔄 Réinitialisation complète (dernier recours)

Si rien ne fonctionne :

```bash
# Arrêter tout
docker compose down

# Attendre 5 secondes
sleep 5

# Redémarrer
docker compose up -d

# Attendre que tout démarre (45 secondes)
sleep 45

# Tester l'API
./test-login.sh

# Si OK, ouvrir le navigateur en mode privé
# et aller sur http://localhost:3010
```

## ✨ Résumé

Le mot de passe est correct. Le problème vient du cache du navigateur.

**Solution rapide :**
1. Ouvrez **http://localhost:3010**
2. **Ctrl + Shift + R** (hard refresh)
3. Connectez-vous avec admin@gmao.com / Admin123!

---

**Date** : 27 janvier 2026  
**Services** : Backend (5010), Frontend (3010), PostgreSQL (5432)
