# Documentation Intégration MQTT

## Vue d'ensemble

Le système GMAO intègre un module MQTT permettant de recevoir automatiquement des données provenant d'équipements industriels connectés via des brokers MQTT (Mosquitto, HiveMQ, etc.) et de mettre à jour les champs des actifs en temps réel.

## Architecture

### Composants Backend

1. **Base de données** (`003_mqtt_integration.sql`)
   - `mqtt_brokers` : Configuration des connexions aux brokers
   - `mqtt_subscriptions` : Topics à écouter avec QoS
   - `mqtt_actif_mappings` : Mapping JSONPath → Champs d'actifs
   - `mqtt_messages_log` : Historique des messages (rétention 30 jours)

2. **Service MQTT** (`src/config/mqtt.js`)
   - Singleton gérant toutes les connexions
   - Reconnexion automatique
   - Traitement des messages via JSONPath
   - Mise à jour automatique des actifs

3. **API REST** (`src/routes/mqtt.routes.js`)
   - 17 endpoints CRUD pour la configuration
   - Statistiques et monitoring en temps réel

### Composants Frontend

1. **Page de configuration** (`src/pages/ConfigurationMQTT.js`)
   - Gestion des brokers (connexion/déconnexion)
   - Configuration des souscriptions (topics)
   - Mapping des données JSON vers les actifs
   - Monitoring des messages reçus

## Installation

### 1. Appliquer la migration

```bash
cd /workspaces/GMAO/backend
node src/database/migrate.js
```

### 2. Installer les dépendances

```bash
# Backend
cd /workspaces/GMAO/backend
npm install mqtt jsonpath-plus

# Frontend
cd /workspaces/GMAO/frontend
npm install react-query date-fns
```

### 3. Démarrer les services

```bash
# Backend (port 5000)
cd /workspaces/GMAO/backend
npm start

# Frontend (port 3000)
cd /workspaces/GMAO/frontend
npm start
```

## Configuration Broker MQTT

### Protocoles supportés

- `mqtt://` : MQTT standard (non sécurisé)
- `mqtts://` : MQTT over TLS
- `ws://` : MQTT over WebSocket
- `wss://` : MQTT over WebSocket sécurisé

### Exemple de configuration Mosquitto

1. **Créer un broker dans l'interface**
   - Nom : `Mosquitto Local`
   - Host : `localhost` ou IP du broker
   - Port : `1883` (standard) ou `8883` (TLS)
   - Protocol : `mqtt`
   - Username/Password : optionnels

2. **Se connecter au broker**
   - Cliquer sur le bouton "Connecter"
   - Le status passe à "Connecté" (vert)

## Configuration des Souscriptions

### Wildcards MQTT

Le système supporte les wildcards MQTT standard :

- **`+`** : Un seul niveau
  - Exemple : `sensors/+/temperature`
  - Match : `sensors/machine1/temperature`, `sensors/machine2/temperature`
  - Ne match pas : `sensors/machine1/zone1/temperature`

- **`#`** : Multi-niveaux (doit être en fin de topic)
  - Exemple : `factory/#`
  - Match : `factory/floor1/machine1`, `factory/floor1/zone2/sensor3`

### Niveaux de QoS

- **QoS 0** : At most once (pas de garantie de livraison)
- **QoS 1** : At least once (garantie de livraison, possibles doublons)
- **QoS 2** : Exactly once (garantie de livraison unique)

### Exemple de souscription

```
Topic: sensors/machine/+/counter
QoS: 1
Description: Compteurs de production de toutes les machines
```

## Mapping des Données

### JSONPath

Le système utilise JSONPath pour extraire les valeurs des payloads JSON.

#### Exemples de payloads et JSONPath

**Payload simple :**
```json
{
  "temperature": 75.5,
  "humidity": 45
}
```
- JSONPath température : `$.temperature`
- JSONPath humidité : `$.humidity`

**Payload imbriqué :**
```json
{
  "sensor": {
    "id": "S001",
    "data": {
      "counter": 12450,
      "unit": "kWh"
    }
  }
}
```
- JSONPath compteur : `$.sensor.data.counter`

**Payload avec tableau :**
```json
{
  "sensors": [
    { "type": "temp", "value": 23.5 },
    { "type": "pressure", "value": 1013 }
  ]
}
```
- JSONPath première valeur : `$.sensors[0].value`
- JSONPath température : `$.sensors[?(@.type=='temp')].value`

### Transformations

Les transformations permettent de modifier la valeur avant stockage :

- **none** : Aucune transformation
- **multiply** : Multiplier par un facteur (ex: W → kW : facteur 0.001)
- **divide** : Diviser par un facteur (ex: Wh → kWh : facteur 1000)
- **round** : Arrondir à l'entier le plus proche
- **floor** : Arrondir à l'entier inférieur
- **ceil** : Arrondir à l'entier supérieur

#### Exemple : Conversion Wh → kWh

```
JSONPath: $.energy.consumption
Transformation: divide
Facteur: 1000
```

Si le payload contient `{"energy": {"consumption": 5432}}`, la valeur stockée sera `5.432` kWh.

## Types de Champs

### Champs Standards

Les champs prédéfinis de la table `actifs` :
- `numero_serie`
- `description`
- Autres champs de la table actifs

### Champs Personnalisés

Champs définis dans `actifs_champs_definition` avec les types :
- **text** : Texte court
- **textarea** : Texte long
- **number** : Nombre décimal
- **date** : Date/heure
- **boolean** : Vrai/Faux
- **select** : Liste déroulante

## Cas d'Usage

### 1. Compteur de Production

**Objectif** : Mettre à jour automatiquement le compteur de production d'une machine.

**Configuration :**
1. Topic : `factory/machine/M001/production`
2. Payload : `{"counter": 12450, "timestamp": "2024-01-21T10:30:00Z"}`
3. Mapping :
   - Actif : Machine M001
   - JSONPath : `$.counter`
   - Champ : `production_counter` (champ personnalisé de type `number`)

### 2. Surveillance Température

**Objectif** : Surveiller la température d'un équipement.

**Configuration :**
1. Topic : `sensors/+/temperature`
2. Payload : `{"value": 75.5, "unit": "°C"}`
3. Mapping :
   - Actif : Équipement correspondant
   - JSONPath : `$.value`
   - Champ : `temperature_actuelle` (champ personnalisé)

### 3. Consommation Énergétique

**Objectif** : Suivre la consommation énergétique en temps réel.

**Configuration :**
1. Topic : `energy/meter/+/consumption`
2. Payload : `{"consumption_wh": 5432000}`
3. Mapping :
   - Actif : Compteur correspondant
   - JSONPath : `$.consumption_wh`
   - Transformation : `divide`
   - Facteur : `1000`
   - Champ : `consommation_kwh`

## Monitoring

### Onglet Status

Affiche pour chaque broker :
- État de connexion
- Nombre de souscriptions
- Nombre de mappings
- Messages reçus (dernière heure / 24 heures)
- Dernière connexion

### Onglet Messages

Historique des 50 derniers messages avec :
- Date/heure de réception
- Broker source
- Topic
- Payload JSON
- État de traitement (traité/non traité)
- Nombre d'actifs mis à jour

## Sécurité

### Authentification Broker

Pour les brokers nécessitant une authentification :
1. Renseigner `username` et `password` dans la configuration
2. Ces informations sont chiffrées dans la base de données

### Connexions TLS

Pour utiliser TLS :
1. Protocole : `mqtts`
2. Port : généralement `8883`
3. Le broker doit avoir un certificat valide

### Permissions Utilisateurs

Les endpoints MQTT nécessitent :
- Authentification : Tous les endpoints
- Permission `actifs.create` : Création de brokers/subscriptions/mappings
- Permission `actifs.edit` : Modification
- Permission `actifs.delete` : Suppression

## Dépannage

### Le broker ne se connecte pas

1. Vérifier host/port/protocol
2. Tester avec un client MQTT externe (`mosquitto_sub`)
3. Vérifier les logs backend : `/workspaces/GMAO/backend/logs/`
4. Vérifier les credentials (username/password)

### Les messages sont reçus mais pas traités

1. Vérifier le JSONPath dans les mappings
2. Tester le JSONPath sur https://jsonpath.com
3. Vérifier que l'actif existe et est actif
4. Consulter l'onglet "Messages" pour voir les erreurs

### Les valeurs ne sont pas mises à jour

1. Vérifier que le mapping pointe vers le bon champ
2. Vérifier le type du champ (number, text, etc.)
3. Vérifier la transformation et le facteur
4. Consulter les logs backend pour les erreurs SQL

## Exemples de Test

### Publier un message de test avec Mosquitto

```bash
# Installation
sudo apt-get install mosquitto-clients

# Publier un message
mosquitto_pub -h localhost -t "sensors/machine/001/counter" -m '{"counter": 12450, "unit": "pieces"}'

# Écouter un topic
mosquitto_sub -h localhost -t "sensors/machine/+/counter"
```

### Test avec Docker Mosquitto

```bash
# Démarrer Mosquitto
docker run -d -p 1883:1883 --name mosquitto eclipse-mosquitto

# Publier un message
docker exec mosquitto mosquitto_pub -t "test/data" -m '{"value": 123}'
```

## Performance

### Optimisations

- Les clients MQTT maintiennent des connexions persistantes
- Les messages sont traités de manière asynchrone
- La base de données utilise des index sur les topics
- Nettoyage automatique des logs > 30 jours

### Limites

- Maximum 100 brokers simultanés (configurable)
- Retention des messages : 30 jours
- QoS 2 peut ralentir les traitements à haut débit

## API REST

### Endpoints Principaux

```
GET    /api/mqtt/brokers          - Liste des brokers
POST   /api/mqtt/brokers          - Créer un broker
GET    /api/mqtt/brokers/:id      - Détails d'un broker
PATCH  /api/mqtt/brokers/:id      - Modifier un broker
DELETE /api/mqtt/brokers/:id      - Supprimer un broker
POST   /api/mqtt/brokers/:id/connect    - Connecter
POST   /api/mqtt/brokers/:id/disconnect - Déconnecter

GET    /api/mqtt/subscriptions    - Liste des souscriptions
POST   /api/mqtt/subscriptions    - Créer une souscription

GET    /api/mqtt/mappings         - Liste des mappings
POST   /api/mqtt/mappings         - Créer un mapping

GET    /api/mqtt/status           - Status global
GET    /api/mqtt/messages         - Historique des messages
```

## Maintenance

### Nettoyage des Logs

La fonction `cleanup_old_mqtt_logs()` est automatiquement appelée chaque nuit pour supprimer les messages de plus de 30 jours.

Nettoyage manuel :
```sql
SELECT cleanup_old_mqtt_logs();
```

### Backup

Inclure les tables suivantes dans les backups :
- `mqtt_brokers`
- `mqtt_subscriptions`
- `mqtt_actif_mappings`
- `mqtt_messages_log` (optionnel)

### Monitoring

Surveiller :
- Nombre de connexions actives
- Taux de messages traités/non traités
- Erreurs dans les logs
- Performances base de données

## Ressources

- Documentation MQTT : https://mqtt.org/
- Mosquitto : https://mosquitto.org/
- JSONPath : https://jsonpath.com/
- HiveMQ : https://www.hivemq.com/
