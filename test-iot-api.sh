#!/bin/bash

# Test script for IoT Devices API
# This script tests the basic functionality of the IoT devices API

echo "🧪 Testing IoT Devices API..."
echo ""

BASE_URL="${BASE_URL:-http://localhost:5000}"
API_URL="$BASE_URL/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local token=$4
    local data=$5
    
    echo -n "Testing: $description... "
    
    local response
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$API_URL$endpoint" 2>&1)
    else
        response=$(curl -s -X "$method" \
            -H "Authorization: Bearer $token" \
            "$API_URL$endpoint" 2>&1)
    fi
    
    if [ $? -eq 0 ] && echo "$response" | grep -q '"data"\|"overview"\|"id"'; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Response: $response"
        return 1
    fi
}

# Check if backend is running
echo "Checking if backend is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}Backend is not running at $BASE_URL${NC}"
    echo "Please start the backend server with: cd backend && npm start"
    exit 1
fi
echo -e "${GREEN}Backend is running${NC}"
echo ""

# Login to get token (requires existing user)
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"admin123"}' \
    "$API_URL/auth/login")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Warning: Could not login. Using default test token.${NC}"
    echo "Please ensure a user exists or update the test credentials."
    TOKEN="test_token"
fi
echo ""

# Test endpoints
echo "Testing IoT Devices API endpoints:"
echo ""

# Test device types
test_endpoint "GET" "/iot-devices/types" "Get IoT device types" "$TOKEN"
test_endpoint "GET" "/iot-devices/stats/overview" "Get IoT statistics" "$TOKEN"
test_endpoint "GET" "/iot-devices" "Get all IoT devices" "$TOKEN"

echo ""
echo "Testing MQTT API endpoints:"
test_endpoint "GET" "/mqtt/brokers" "Get MQTT brokers" "$TOKEN"
test_endpoint "GET" "/mqtt/status" "Get MQTT status" "$TOKEN"

echo ""
echo -e "${GREEN}✓ API tests completed${NC}"
echo ""
echo "Note: To fully test device creation, you need to:"
echo "  1. Have a PostgreSQL database running with the schema"
echo "  2. Run the migration: cd backend && node src/database/migrate.js"
echo "  3. Have valid actif_id and device_type_id for creation tests"
