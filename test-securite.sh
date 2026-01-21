#!/bin/bash

# Script de test des améliorations de sécurité GMAO
# Auteur: Équipe de développement GMAO
# Date: $(date)

echo "🔒 Tests de Sécurité GMAO"
echo "=========================="
echo ""

API_URL="http://localhost:5000"
AUTH_URL="$API_URL/api/auth/login"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Validation - Email invalide
echo "📝 Test 1: Validation - Email invalide"
RESPONSE=$(curl -s -X POST "$AUTH_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalide","password":"test123"}' \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" == "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Email invalide rejeté (400)"
else
  echo -e "${RED}❌ FAIL${NC} - Code attendu: 400, reçu: $HTTP_CODE"
fi
echo ""

# Test 2: Validation - Mot de passe trop court lors de l'inscription
echo "📝 Test 2: Validation - Mot de passe trop court"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123","prenom":"Test","nom":"User"}' \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" == "400" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Mot de passe court rejeté (400)"
else
  echo -e "${RED}❌ FAIL${NC} - Code attendu: 400, reçu: $HTTP_CODE"
fi
echo ""

# Test 3: Rate Limiting - Tentatives multiples de connexion
echo "📝 Test 3: Rate Limiting - Tentatives de connexion"
echo "   Envoi de 6 requêtes (limite: 5)..."
SUCCESS_COUNT=0
for i in {1..6}; do
  RESPONSE=$(curl -s -X POST "$AUTH_URL" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrongpassword"}' \
    -w "\n%{http_code}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ $i -le 5 ]; then
    if [ "$HTTP_CODE" == "401" ]; then
      ((SUCCESS_COUNT++))
    fi
  else
    if [ "$HTTP_CODE" == "429" ]; then
      echo -e "${GREEN}✅ PASS${NC} - Rate limiting actif (429 Too Many Requests)"
    else
      echo -e "${RED}❌ FAIL${NC} - Attendu: 429, reçu: $HTTP_CODE"
    fi
  fi
  sleep 0.5
done
echo ""

# Test 4: Route non authentifiée
echo "📝 Test 4: Protection des routes - Sans token"
RESPONSE=$(curl -s -X GET "$API_URL/api/sites" \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" == "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Route protégée (401)"
else
  echo -e "${RED}❌ FAIL${NC} - Code attendu: 401, reçu: $HTTP_CODE"
fi
echo ""

# Test 5: Pagination
echo "📝 Test 5: Pagination - Paramètres"
echo "   (Test manuel nécessaire après authentification)"
echo -e "${YELLOW}⚠️  SKIP${NC} - Nécessite un token valide"
echo ""

# Test 6: Headers de sécurité (Helmet)
echo "📝 Test 6: Headers de sécurité (Helmet)"
HEADERS=$(curl -s -I "$API_URL/health")
if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
  echo -e "${GREEN}✅ PASS${NC} - X-Content-Type-Options présent"
else
  echo -e "${RED}❌ FAIL${NC} - X-Content-Type-Options manquant"
fi
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
  echo -e "${GREEN}✅ PASS${NC} - X-Frame-Options présent"
else
  echo -e "${RED}❌ FAIL${NC} - X-Frame-Options manquant"
fi
echo ""

# Test 7: Route inexistante
echo "📝 Test 7: Gestion 404"
RESPONSE=$(curl -s -X GET "$API_URL/api/inexistant" \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" == "404" ]; then
  echo -e "${GREEN}✅ PASS${NC} - 404 pour route inexistante"
else
  echo -e "${RED}❌ FAIL${NC} - Code attendu: 404, reçu: $HTTP_CODE"
fi
echo ""

# Résumé
echo "=========================="
echo "✅ Tests terminés"
echo ""
echo "📌 Notes:"
echo "- Certains tests nécessitent que le serveur soit démarré"
echo "- Le rate limiting peut nécessiter d'attendre 15 min entre les tests"
echo "- Pour réinitialiser: redémarrer le serveur"
echo ""
echo "🔍 Vérifications manuelles à faire:"
echo "  1. Logs créés dans backend/logs/"
echo "  2. Password_hash absent des réponses API"
echo "  3. Pagination fonctionne (?page=2&limit=10)"
echo "  4. Validation affiche messages d'erreur clairs"
