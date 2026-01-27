# Test des Compteurs - Interface Utilisateur

## État actuel

### ✅ Backend fonctionnel
- API `/api/compteurs/actif/{id}` retourne les compteurs correctement
- 2 compteurs créés pour le type "Machines de production":
  1. **heures_fonctionnement** (unité: heures)
  2. **nb_cycles** (unité: cycles)

### ✅ Corrections appliquées
- Routes `/api/compteurs/alertes` et `/api/compteurs/templates` désactivées (tables manquantes)
- Logs de debug ajoutés dans CompteursActif.js
- Gestion d'erreur améliorée
- Imports inutilisés nettoyés

## Test manuel requis

### Étape 1 : Ouvrir l'interface
```bash
# Navigateur
http://localhost:3010
```

### Étape 2 : Se connecter
- Email: admin@gmao.com
- Mot de passe: Admin123!

### Étape 3 : Naviguer vers un actif
1. Menu latéral → "Actifs"
2. Cliquer sur un actif de type "Machines de production"
3. Onglet "Compteurs et seuils"

### Étape 4 : Vérifier les logs console
Ouvrir la console du navigateur (F12) et chercher :
```
CompteursActif - API Response: {success: true, data: Array(2)}
CompteursActif - compteursData: {success: true, data: Array(2)}
CompteursActif - compteurs array: Array(2)
CompteursActif - compteurs.length: 2
```

### Étape 5 : Vérifier l'affichage
L'interface devrait afficher :
- Titre "Compteurs et Seuils"
- 2 cartes avec :
  - "Heures de fonctionnement" (unité: heures)
  - "Nombre de cycles" (unité: cycles)
- Bouton "Saisir" sur chaque carte

## Test API direct

```bash
# Test avec curl
TOKEN=$(cat /tmp/fresh_token.txt)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5010/api/compteurs/actif/d652f4ba-f8ef-4c51-b014-a969043f1ada

# Résultat attendu:
# {
#   "success": true,
#   "data": [
#     {
#       "champ_id": "e35d01a1-57f9-40e0-af9b-23707235ef4e",
#       "nom": "heures_fonctionnement",
#       "libelle": "Heures de fonctionnement",
#       "unite": "heures",
#       "description": "Total heures machine",
#       "valeur_actuelle": null,
#       "derniere_mise_a_jour": null
#     },
#     {
#       "champ_id": "abc28e99-a030-4656-9e71-46859300c0c0",
#       "nom": "nb_cycles",
#       "libelle": "Nombre de cycles",
#       "unite": "cycles",
#       "description": "Compteur de cycles de production",
#       "valeur_actuelle": null,
#       "derniere_mise_a_jour": null
#     }
#   ]
# }
```

## Problèmes connus et solutions

### Problème : "Aucun compteur défini"
**Cause possible** : actif_id non passé ou requête échoue
**Solution** : Vérifier les logs console pour voir l'erreur exacte

### Problème : Erreurs 403 lors de la saisie
**Cause** : Permissions insuffisantes
**Solution** : Vérifier que l'utilisateur a la permission `compteurs.saisie`

### Problème : Page blanche ou erreur
**Cause** : Erreur JavaScript dans le composant
**Solution** : Vérifier la console navigateur (F12)

## Prochaines étapes

1. ✅ Afficher les compteurs (en cours de vérification)
2. ⏳ Activer la fonctionnalité de saisie
3. ⏳ Créer la table/vue pour les alertes
4. ⏳ Implémenter les seuils d'alertes
