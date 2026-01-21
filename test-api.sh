#!/bin/bash

echo "=== Test Complet de l'API GMAO ==="
echo ""

BASE_URL="http://localhost:5000"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_passed=0
test_failed=0

# Fonction de test
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    echo -n "Testing $name... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        test_passed=$((test_passed + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        echo "Response: $body"
        test_failed=$((test_failed + 1))
        return 1
    fi
}

# 1. Health Check
echo -e "${YELLOW}1. Health Check${NC}"
test_endpoint "Health" "GET" "/health" "" "200"
echo ""

# 2. Authentication
echo -e "${YELLOW}2. Authentication${NC}"
sleep 2
auth_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@gmao.com","password":"Admin123!"}')

TOKEN=$(echo "$auth_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    test_passed=$((test_passed + 1))
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $auth_response"
    test_failed=$((test_failed + 1))
    exit 1
fi
echo ""

# 3. Sites
echo -e "${YELLOW}3. Sites API${NC}"
test_endpoint "GET Sites" "GET" "/api/sites" "" "200"
test_endpoint "POST Site" "POST" "/api/sites" '{"nom":"Site Test API","code":"TEST-API","ville":"Lyon","pays":"France"}' "201"
echo ""

# 4. Actifs
echo -e "${YELLOW}4. Actifs API${NC}"
test_endpoint "GET Actifs" "GET" "/api/actifs" "" "200"
echo ""

# 5. Ordres de Travail
echo -e "${YELLOW}5. Ordres de Travail API${NC}"
test_endpoint "GET OT" "GET" "/api/ordres-travail" "" "200"
echo ""

# 6. Demandes
echo -e "${YELLOW}6. Demandes API${NC}"
test_endpoint "GET Demandes" "GET" "/api/demandes" "" "200"
echo ""

# 7. Dashboard
echo -e "${YELLOW}7. Dashboard Stats${NC}"
test_endpoint "GET Stats" "GET" "/api/dashboard/stats" "" "200"
echo ""

# 8. Search
echo -e "${YELLOW}8. Search API${NC}"
test_endpoint "Search Global" "GET" "/api/search?q=test" "" "200"
echo ""

# 9. Notifications
echo -e "${YELLOW}9. Notifications API${NC}"
test_endpoint "GET Notifications" "GET" "/api/notifications" "" "200"
test_endpoint "GET Unread Count" "GET" "/api/notifications/unread-count" "" "200"
echo ""

# 10. Documents
echo -e "${YELLOW}10. Documents API${NC}"
test_endpoint "GET Documents" "GET" "/api/documents" "" "200"
echo ""

# Résumé
echo "================================"
echo -e "${GREEN}Tests passés: $test_passed${NC}"
echo -e "${RED}Tests échoués: $test_failed${NC}"
echo "================================"

if [ $test_failed -eq 0 ]; then
    echo -e "${GREEN}✓ Tous les tests sont passés !${NC}"
    exit 0
else
    echo -e "${RED}✗ Certains tests ont échoué${NC}"
    exit 1
fi
