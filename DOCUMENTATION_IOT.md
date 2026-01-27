# Documentation - Gestion des Dispositifs IoT

## Vue d'ensemble

Le module de gestion des dispositifs IoT permet d'administrer et de surveiller les dispositifs IoT associés aux machines (actifs) de l'entreprise. Ce module s'intègre avec le système MQTT existant pour recevoir et traiter les données en temps réel.

## Fonctionnalités

### 1. Types de Dispositifs IoT

Le système supporte plusieurs types de dispositifs IoT prédéfinis :

- **Capteur Température/Humidité** : Mesure la température et l'humidité ambiante
- **Compteur Électrique** : Mesure la consommation électrique, courant, tension, facteur de puissance
- **Capteur de Pression** : Mesure la pression et la température
- **Détecteur d'Ouverture** : Détecte l'ouverture de portes ou panneaux
- **Capteur Vibration** : Mesure les vibrations des machines
- **Capteur Multi-paramètres** : Dispositif configurable avec paramètres personnalisés

Chaque type de dispositif peut avoir ses propres paramètres configurables.

### 2. Gestion des Dispositifs

#### Création d'un Dispositif IoT

Pour créer un nouveau dispositif IoT :

1. Accéder à la page "Dispositifs IoT" depuis le menu
2. Cliquer sur "Nouveau Dispositif"
3. Remplir les informations :
   - **Nom** : Nom descriptif du dispositif
   - **Identifiant Unique** : Serial number, MAC address, ou autre identifiant unique
   - **Type de Dispositif** : Sélectionner le type dans la liste
   - **Machine Associée** : Sélectionner l'actif (machine) associé
   - **Broker MQTT** : Sélectionner le broker MQTT (optionnel)
   - **Topic MQTT de Base** : Topic de base pour ce dispositif (ex: `factory/machine/M001`)
   - **Fabricant, Modèle, Version Firmware** : Informations techniques
   - **Date d'Installation** : Date de mise en service
   - **Statut** : actif, inactif, maintenance, erreur
   - **Notes** : Notes additionnelles

#### Modification d'un Dispositif

Pour modifier un dispositif existant, cliquer sur l'icône "Modifier" (crayon) dans la liste des dispositifs.

#### Suppression d'un Dispositif

Pour supprimer un dispositif, cliquer sur l'icône "Supprimer" (poubelle). Une confirmation sera demandée.

### 3. Configuration des Paramètres

#### Accéder à la Configuration

Pour configurer les paramètres d'un dispositif :

1. Cliquer sur l'icône "Configurer" (engrenage) dans la liste des dispositifs
2. Un nouvel onglet s'ouvre avec les détails du dispositif

#### Ajouter un Paramètre

1. Dans l'onglet de configuration, cliquer sur "Ajouter un Paramètre"
2. Sélectionner le paramètre à configurer (basé sur le type de dispositif)
3. Configurer :
   - **Suffixe du Topic MQTT** : Suffixe à ajouter au topic de base (ex: `/temperature`)
   - **JSONPath** : Chemin pour extraire la valeur du payload JSON (ex: `$.value`, `$.data.temperature`)
   - **Transformation** : Transformation à appliquer (aucune, multiplier, diviser, arrondir)
   - **Facteur** : Facteur de transformation (ex: 0.001 pour convertir W en kW)
   - **Seuils Min/Max** : Seuils d'alerte pour le paramètre
   - **Fréquence de Lecture** : Fréquence souhaitée en secondes

#### Exemple de Configuration

**Scénario** : Configuration d'un capteur de température

- Type de dispositif : Capteur Température/Humidité
- Machine associée : Machine M001
- Topic MQTT de base : `factory/machine/M001`
- Paramètre : Température
  - Suffixe topic : `/temperature`
  - Topic complet : `factory/machine/M001/temperature`
  - JSONPath : `$.value`
  - Transformation : aucune
  - Seuils : Min: 15°C, Max: 35°C

**Payload MQTT attendu** :
```json
{
  "value": 23.5,
  "unit": "°C",
  "timestamp": "2024-01-27T18:00:00Z"
}
```

### 4. Surveillance en Temps Réel

#### Tableau de Bord

Le tableau de bord affiche :
- Nombre total de dispositifs
- Nombre de dispositifs actifs
- Nombre de dispositifs en ligne (communication dans la dernière heure)
- Nombre de dispositifs en erreur

#### Dernières Valeurs

Dans l'onglet de configuration d'un dispositif, la section "Dernières Valeurs" affiche :
- Les dernières valeurs reçues pour chaque paramètre configuré
- L'horodatage de la dernière mise à jour
- L'unité de mesure

Ces valeurs sont rafraîchies automatiquement toutes les 10 secondes.

#### Statut des Dispositifs

Dans la liste des dispositifs, chaque ligne affiche :
- Le statut du dispositif (actif, inactif, maintenance, erreur)
- L'état de connexion du broker MQTT
- La date de dernière communication

### 5. Historique des Valeurs

Le système conserve un historique de toutes les valeurs reçues dans la table `iot_device_values_history`.

Par défaut, l'historique est conservé pendant 90 jours. Cette durée peut être modifiée.

Pour nettoyer manuellement l'historique :
```sql
SELECT cleanup_old_iot_values(90); -- Nettoyer les données de plus de 90 jours
```

## Intégration avec MQTT

### Flux de Données

1. Le dispositif IoT publie des données sur un topic MQTT
2. Le broker MQTT reçoit les données
3. Le système GMAO écoute les topics configurés
4. Les données sont parsées selon le JSONPath configuré
5. Les transformations sont appliquées si nécessaire
6. Les valeurs sont stockées dans l'historique
7. Les champs des actifs sont mis à jour automatiquement
8. Les seuils sont vérifiés et des alertes peuvent être créées

### Configuration MQTT

Pour que les données IoT soient reçues automatiquement :

1. Configurer un broker MQTT dans "Configuration MQTT"
2. Créer une souscription au topic du dispositif (ou utiliser des wildcards)
3. Créer un dispositif IoT avec le même topic de base
4. Configurer les paramètres du dispositif
5. Les données seront automatiquement traitées à réception

### Exemple Complet

**Configuration Broker MQTT** :
- Nom : Mosquitto Local
- Host : localhost
- Port : 1883
- Protocol : mqtt

**Souscription MQTT** :
- Topic : `factory/machine/+/temperature`
- QoS : 1

**Dispositif IoT** :
- Nom : Capteur Température Machine M001
- Type : Capteur Température/Humidité
- Machine : M001
- Topic de base : `factory/machine/M001`

**Configuration Paramètre** :
- Paramètre : Température
- Suffixe topic : `/temperature`
- JSONPath : `$.value`
- Seuil Min : 15
- Seuil Max : 35

**Message MQTT publié** :
```bash
mosquitto_pub -h localhost -t "factory/machine/M001/temperature" \
  -m '{"value": 23.5, "unit": "°C", "timestamp": "2024-01-27T18:00:00Z"}'
```

**Résultat** :
- La valeur 23.5 est extraite du JSON
- Elle est stockée dans l'historique
- Le champ personnalisé "température" de la machine M001 est mis à jour
- Si la valeur dépasse les seuils, une alerte est créée

## API REST

### Endpoints Dispositifs IoT

#### Types de Dispositifs
```
GET    /api/iot-devices/types                    - Liste des types
GET    /api/iot-devices/types/:id                - Détail d'un type
POST   /api/iot-devices/types                    - Créer un type
PATCH  /api/iot-devices/types/:id                - Modifier un type
```

#### Paramètres des Types
```
GET    /api/iot-devices/types/:typeId/parameters - Liste des paramètres d'un type
POST   /api/iot-devices/types/:typeId/parameters - Créer un paramètre
PATCH  /api/iot-devices/parameters/:id           - Modifier un paramètre
DELETE /api/iot-devices/parameters/:id           - Supprimer un paramètre
```

#### Dispositifs
```
GET    /api/iot-devices                          - Liste des dispositifs
GET    /api/iot-devices/:id                      - Détail d'un dispositif
POST   /api/iot-devices                          - Créer un dispositif
PATCH  /api/iot-devices/:id                      - Modifier un dispositif
DELETE /api/iot-devices/:id                      - Supprimer un dispositif
```

#### Configuration des Paramètres
```
GET    /api/iot-devices/:deviceId/parameter-configs       - Liste des configurations
POST   /api/iot-devices/:deviceId/parameter-configs       - Créer/Modifier une configuration
DELETE /api/iot-devices/:deviceId/parameter-configs/:id   - Supprimer une configuration
```

#### Valeurs et Historique
```
GET    /api/iot-devices/:deviceId/values-history  - Historique des valeurs
GET    /api/iot-devices/:deviceId/latest-values   - Dernières valeurs
```

#### Statistiques
```
GET    /api/iot-devices/stats/overview            - Statistiques globales
```

## Base de Données

### Tables Principales

- **iot_device_types** : Types de dispositifs IoT
- **iot_device_parameters** : Paramètres disponibles par type
- **iot_devices** : Dispositifs IoT enregistrés
- **iot_device_parameter_configs** : Configuration des paramètres pour chaque dispositif
- **iot_device_values_history** : Historique des valeurs reçues

### Vues Utiles

- **v_iot_devices_status** : Vue consolidée du statut des dispositifs
- **v_iot_device_latest_values** : Dernières valeurs pour chaque paramètre

### Trigger Automatique

Un trigger met automatiquement à jour la date de dernière communication d'un dispositif lorsqu'une nouvelle valeur est reçue.

## Sécurité

### Permissions Requises

- **actifs.view** : Voir les dispositifs IoT
- **actifs.create** : Créer des dispositifs et configurations
- **actifs.edit** : Modifier des dispositifs et configurations
- **actifs.delete** : Supprimer des dispositifs et configurations

### Authentification

Tous les endpoints nécessitent une authentification via JWT token.

### Audit

Toutes les opérations de création, modification et suppression sont enregistrées dans le système d'audit.

## Bonnes Pratiques

### Nommage des Dispositifs

- Utiliser des noms descriptifs : "Capteur Température Salle A1"
- Inclure l'emplacement si pertinent
- Utiliser une convention de nommage cohérente

### Identifiants Uniques

- Utiliser le serial number du fabricant
- Ou l'adresse MAC pour les dispositifs réseau
- Éviter les identifiants génériques ou dupliqués

### Topics MQTT

- Structure hiérarchique : `factory/zone/machine/parameter`
- Utiliser des noms en anglais pour éviter les problèmes d'encodage
- Éviter les caractères spéciaux
- Préférer les underscores aux espaces

### Configuration des Seuils

- Définir des seuils réalistes basés sur les spécifications techniques
- Prévoir une marge de tolérance
- Tester les alertes avant la mise en production

### Fréquence de Lecture

- Adapter la fréquence selon le type de données
  - Température : 30-60 secondes
  - Vibration : 5-10 secondes
  - Compteur électrique : 60-300 secondes
- Éviter les fréquences trop élevées pour ne pas surcharger le système

## Maintenance

### Nettoyage Automatique

Le système nettoie automatiquement l'historique des valeurs de plus de 90 jours.

### Surveillance

Surveiller régulièrement :
- Les dispositifs qui ne communiquent plus
- Les dispositifs en erreur
- Les alertes de seuils
- La consommation d'espace disque de l'historique

### Sauvegarde

Inclure dans les sauvegardes régulières :
- Tables de configuration des dispositifs
- Historique des valeurs récentes (selon la politique de rétention)

## Dépannage

### Le dispositif n'apparaît pas dans la liste

- Vérifier que le dispositif est créé et actif
- Vérifier les permissions utilisateur
- Recharger la page

### Aucune donnée n'est reçue

- Vérifier que le broker MQTT est connecté
- Vérifier que la souscription au topic existe
- Vérifier que le topic du dispositif correspond au topic publié
- Tester avec mosquitto_sub pour voir si les messages arrivent
- Vérifier les logs backend

### Les valeurs ne sont pas correctes

- Vérifier le JSONPath configuré
- Tester le JSONPath sur jsonpath.com
- Vérifier la transformation et le facteur
- Vérifier le format du payload JSON

### Problèmes de performance

- Réduire la fréquence de lecture
- Nettoyer l'historique ancien
- Vérifier les index de la base de données
- Limiter le nombre de paramètres par dispositif

## Support

Pour toute question ou problème :
1. Consulter cette documentation
2. Consulter la documentation MQTT (DOCUMENTATION_MQTT.md)
3. Vérifier les logs backend
4. Contacter l'équipe de support technique
