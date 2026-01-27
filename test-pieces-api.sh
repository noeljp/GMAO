#!/bin/bash

echo "========================================="
echo "Testing Pieces API Endpoints"
echo "========================================="

# First, login to get a token
echo -e "\n1. Login to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmao.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained successfully"

# Test GET /api/pieces
echo -e "\n2. GET /api/pieces - List all pieces..."
curl -s -X GET http://localhost:5000/api/pieces \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test GET a specific piece
echo -e "\n3. GET /api/pieces/:id - Get first piece details..."
PIECE_ID=$(curl -s -X GET http://localhost:5000/api/pieces \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

if [ ! -z "$PIECE_ID" ] && [ "$PIECE_ID" != "null" ]; then
  curl -s -X GET "http://localhost:5000/api/pieces/$PIECE_ID" \
    -H "Authorization: Bearer $TOKEN" | jq '.'
fi

# Test POST /api/pieces - Create a new piece
echo -e "\n4. POST /api/pieces - Create new piece..."
NEW_PIECE=$(curl -s -X POST http://localhost:5000/api/pieces \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST-999",
    "designation": "Test piece for API",
    "reference_interne": "TEST-INT-999",
    "reference_fabricant": "TEST-FAB-999",
    "fournisseur": "Test Supplier",
    "site_internet_fournisseur": "https://www.test.com",
    "prix_indicatif": 99.99,
    "unite": "pièce",
    "quantite_stock": 50,
    "seuil_minimum": 10,
    "remarques": "This is a test piece"
  }')

echo $NEW_PIECE | jq '.'
NEW_PIECE_ID=$(echo $NEW_PIECE | jq -r '.id')

# Test PATCH /api/pieces/:id - Update piece
if [ ! -z "$NEW_PIECE_ID" ] && [ "$NEW_PIECE_ID" != "null" ]; then
  echo -e "\n5. PATCH /api/pieces/:id - Update piece..."
  curl -s -X PATCH "http://localhost:5000/api/pieces/$NEW_PIECE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"quantite_stock": 75, "remarques": "Updated test piece"}' | jq '.'
fi

echo -e "\n========================================="
echo "API Tests Completed"
echo "========================================="
