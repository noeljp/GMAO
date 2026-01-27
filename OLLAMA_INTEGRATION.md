# Ollama LLM Integration - Documentation

## Vue d'ensemble

L'intégration Ollama permet aux techniciens de reformuler automatiquement leurs descriptions techniques à l'aide d'un modèle de langage (LLM) pour les rendre plus claires, professionnelles et structurées.

## Fonctionnalités

- **Reformulation intelligente**: Améliore automatiquement les descriptions des techniciens
- **Contexte enrichi**: Utilise les informations de l'actif associé pour une reformulation contextuelle
- **Interface intuitive**: Bouton avec icône sparkle (✨) directement dans les formulaires
- **Prévisualisation**: Affiche une comparaison avant/après avant d'accepter la reformulation

## Configuration

### Variables d'environnement

Ajoutez les variables suivantes dans le fichier `.env` du backend:

```env
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
OLLAMA_TIMEOUT=30000
```

### Description des variables

- **OLLAMA_URL**: URL du service Ollama (par défaut: `http://localhost:11434`)
- **OLLAMA_MODEL**: Modèle LLM à utiliser (par défaut: `llama2`)
- **OLLAMA_TIMEOUT**: Timeout en millisecondes pour les requêtes (par défaut: `30000` = 30 secondes)

### Prérequis

1. **Service Ollama installé et démarré** sur le serveur
   ```bash
   # Installation d'Ollama (exemple pour Linux)
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Télécharger un modèle
   ollama pull llama2
   
   # Démarrer le service
   ollama serve
   ```

2. **Dépendances installées**
   ```bash
   cd backend
   npm install
   ```

## Utilisation

### Interface utilisateur

1. **Dans le formulaire de Demande d'intervention**:
   - Saisissez une description dans le champ "Description"
   - Sélectionnez un actif (optionnel mais recommandé pour plus de contexte)
   - Cliquez sur l'icône sparkle (✨) à droite du champ description
   - Patientez pendant la reformulation
   - Prévisualisez la proposition
   - Cliquez sur "Utiliser cette reformulation" pour accepter ou "Annuler" pour rejeter

2. **Dans le formulaire d'Ordre de travail**:
   - Même processus que pour les demandes d'intervention

### Exemple de reformulation

**Description originale du technicien**:
```
machine fait bruit bizarre depuis ce matin, ça vient de la pompe je crois
```

**Description reformulée par l'IA**:
```
Anomalie détectée sur la machine depuis ce matin. Bruit anormal identifié au niveau
de la pompe hydraulique. Investigation requise pour déterminer l'origine du 
dysfonctionnement et planifier l'intervention corrective appropriée.
```

## API Endpoints

### POST /api/ollama/reformulate

Reformule une description avec contexte.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body**:
```json
{
  "description": "machine fait bruit bizarre",
  "actif_id": "uuid-de-l-actif",
  "type_intervention": "panne",
  "priorite": "moyenne"
}
```

**Response**:
```json
{
  "success": true,
  "original": "machine fait bruit bizarre",
  "reformulated": "Anomalie détectée...",
  "context_used": true
}
```

### GET /api/ollama/health

Vérifie l'état du service Ollama.

**Response**:
```json
{
  "success": true,
  "status": "healthy",
  "url": "http://localhost:11434"
}
```

### GET /api/ollama/models

Liste les modèles disponibles.

**Response**:
```json
{
  "success": true,
  "models": [
    {
      "name": "llama2:latest",
      "size": 3826793677
    }
  ],
  "current_model": "llama2"
}
```

## Architecture

### Backend

```
backend/
├── src/
│   ├── services/
│   │   └── ollama.service.js    # Service d'intégration Ollama
│   └── routes/
│       └── ollama.routes.js     # Routes API
```

### Frontend

```
frontend/
├── src/
│   ├── components/
│   │   └── LLMReformulateButton.js    # Composant réutilisable
│   └── pages/
│       ├── Demandes.js                # Intégration dans demandes
│       └── OrdresTravail.js           # Intégration dans OT
```

## Contexte utilisé pour la reformulation

Le système enrichit automatiquement le prompt envoyé au LLM avec:

1. **Informations de l'actif** (si fourni):
   - Code interne
   - Description
   - Type d'actif
   - Localisation

2. **Métadonnées de l'intervention**:
   - Type d'intervention (panne, maintenance, etc.)
   - Priorité (basse, moyenne, haute, urgente)

## Gestion des erreurs

Le système gère plusieurs types d'erreurs:

- **Service Ollama non disponible**: Message d'erreur clair à l'utilisateur
- **Timeout**: Délai d'attente dépassé (configurable)
- **Description vide**: Validation côté client et serveur
- **Erreur réseau**: Gestion des problèmes de connexion

## Performance

- **Temps de réponse moyen**: 5-15 secondes selon le modèle et la longueur du texte
- **Timeout par défaut**: 30 secondes
- **Impact serveur**: Dépend du modèle utilisé (recommandé: 8GB RAM minimum pour llama2)

## Modèles recommandés

1. **llama2** (par défaut): Bon équilibre performance/qualité
2. **mistral**: Excellent pour le français
3. **codellama**: Si descriptions très techniques

Pour changer de modèle:
```bash
# Télécharger un nouveau modèle
ollama pull mistral

# Mettre à jour .env
OLLAMA_MODEL=mistral
```

## Sécurité

- **Authentification requise**: Toutes les routes nécessitent un token JWT valide
- **Validation des entrées**: Tous les paramètres sont validés
- **Pas de stockage des prompts**: Les descriptions ne sont pas conservées par le service
- **Logs**: Toutes les requêtes sont loggées (sans contenu sensible)

## Troubleshooting

### Le bouton ne fait rien

- Vérifier que le service Ollama est démarré: `curl http://localhost:11434/api/tags`
- Vérifier les logs backend pour les erreurs de connexion

### Timeout fréquents

- Augmenter `OLLAMA_TIMEOUT` dans `.env`
- Utiliser un modèle plus léger
- Vérifier les ressources serveur (CPU/RAM)

### Reformulations de mauvaise qualité

- Essayer un autre modèle (mistral, llama3, etc.)
- Vérifier que le contexte (actif) est bien fourni
- Ajuster le prompt dans `ollama.service.js` si nécessaire

## Support et contact

Pour toute question ou problème:
- Consulter les logs: `backend/logs/`
- Vérifier la santé du service: GET `/api/ollama/health`
- Tester un modèle: `ollama run <model-name>`
