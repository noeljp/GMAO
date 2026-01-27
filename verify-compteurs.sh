#!/bin/bash

echo "🔍 Vérification des Compteurs GMAO"
echo "===================================="
echo ""

# Récupérer un token
echo "📝 Connexion..."
TOKEN=$(curl -s -X POST http://localhost:5010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmao.com","password":"Admin123!"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Échec de connexion"
    exit 1
fi

echo "✅ Connecté"
echo ""

# Lister les actifs de type "Machines de production"
echo "📋 Actifs de type 'Machines de production':"
echo "-------------------------------------------"
ACTIFS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5010/api/actifs | \
    jq -r '.data[] | select(.type_nom == "Machines de production") | "\(.id)|\(.designation)"')

if [ -z "$ACTIFS" ]; then
    echo "⚠️  Aucun actif de type 'Machines de production' trouvé"
    echo ""
    echo "Types disponibles:"
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5010/api/actifs/types | jq -r '.data[] | "  - \(.nom)"'
    exit 0
fi

echo "$ACTIFS" | while IFS='|' read -r ID DESIGNATION; do
    echo ""
    echo "🔧 Actif: $DESIGNATION"
    echo "   ID: $ID"
    
    # Vérifier les compteurs pour cet actif
    COMPTEURS=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "http://localhost:5010/api/compteurs/actif/$ID")
    
    NB_COMPTEURS=$(echo "$COMPTEURS" | jq '.data | length')
    
    if [ "$NB_COMPTEURS" = "0" ]; then
        echo "   ❌ Aucun compteur"
    else
        echo "   ✅ $NB_COMPTEURS compteur(s):"
        echo "$COMPTEURS" | jq -r '.data[] | "      - \(.libelle) (\(.unite))"'
    fi
done

echo ""
echo "================================================"
echo ""

# Vérifier le type et ses champs
echo "📊 Champs du type 'Machines de production':"
echo "--------------------------------------------"
TYPE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5010/api/actifs/types | \
    jq -r '.data[] | select(.nom == "Machines de production") | .id')

if [ -z "$TYPE_ID" ] || [ "$TYPE_ID" = "null" ]; then
    echo "❌ Type 'Machines de production' non trouvé"
else
    echo "Type ID: $TYPE_ID"
    echo ""
    
    CHAMPS=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "http://localhost:5010/api/types-actifs/$TYPE_ID")
    
    NB_CHAMPS_NUMBER=$(echo "$CHAMPS" | jq '[.data.champs[] | select(.type_champ == "number")] | length')
    
    echo "Champs de type 'number' (compteurs): $NB_CHAMPS_NUMBER"
    echo "$CHAMPS" | jq -r '.data.champs[] | select(.type_champ == "number") | "  - \(.libelle) (unité: \(.unite))"'
fi

echo ""
echo "================================================"
echo ""
echo "💡 Instructions:"
echo ""
echo "1. Si aucun compteur n'apparaît pour les actifs:"
echo "   - Vérifiez que le type 'Machines de production' a des champs 'number'"
echo "   - Allez dans le menu 'Types d'actifs' pour en créer"
echo ""
echo "2. Si les champs existent mais ne s'affichent pas:"
echo "   - Ouvrez la console du navigateur (F12)"
echo "   - Rechargez la page de l'actif"
echo "   - Vérifiez les logs 'CompteursActif'"
echo ""
echo "3. URL frontend: http://localhost:3010"
echo "   Actifs → Sélectionner un actif → Onglet 'Compteurs et seuils'"
