#!/bin/bash

echo "🔍 Test de connexion GMAO"
echo "=========================="
echo ""

# Attendre que le backend soit prêt
echo "⏳ Attente du backend (10 secondes)..."
sleep 10

# Test de connexion
echo "🔐 Test de connexion avec admin@gmao.com / Admin123!"
RESPONSE=$(curl -s -X POST http://localhost:5010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmao.com","password":"Admin123!"}')

echo ""
echo "📋 Réponse du serveur:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Vérifier si on a un token
if echo "$RESPONSE" | grep -q "token"; then
    echo ""
    echo "✅ CONNEXION RÉUSSIE!"
    TOKEN=$(echo "$RESPONSE" | jq -r '.token' 2>/dev/null)
    echo "Token: ${TOKEN:0:50}..."
else
    echo ""
    echo "❌ ÉCHEC DE CONNEXION"
    # Vérifier si c'est un rate limit
    if echo "$RESPONSE" | grep -q "429"; then
        echo "⚠️  Rate limit atteint - Attendez 15 minutes ou redémarrez le backend:"
        echo "   docker compose restart backend"
    fi
fi
