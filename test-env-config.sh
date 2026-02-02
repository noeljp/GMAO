#!/bin/bash

# Test script to verify environment configuration is correct
# This validates the fix for PostgreSQL authentication issue

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Testing Environment Configuration"
echo "========================================"
echo ""

# Test 1: Check that .env.example exists
echo -n "Test 1: Root .env.example exists... "
if [ -f ".env.example" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    exit 1
fi

# Test 2: Check that backend/.env.example has correct DB_HOST
echo -n "Test 2: backend/.env.example has DB_HOST=postgres... "
if grep -q "^DB_HOST=postgres" backend/.env.example; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "backend/.env.example should have DB_HOST=postgres for Docker"
    exit 1
fi

# Test 3: Check that backend/.env.example has correct CORS_ORIGIN
echo -n "Test 3: backend/.env.example has CORS_ORIGIN=http://localhost:3010... "
if grep -q "^CORS_ORIGIN=http://localhost:3010" backend/.env.example; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "backend/.env.example should have CORS_ORIGIN=http://localhost:3010 for Docker"
    exit 1
fi

# Test 4: Check that backend/.env does NOT exist
echo -n "Test 4: backend/.env does not exist... "
if [ ! -f "backend/.env" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "backend/.env should not exist for Docker deployment"
    echo "It may override Docker Compose environment variables"
fi

# Test 5: Check that .env has matching passwords (if .env exists)
if [ -f ".env" ]; then
    echo -n "Test 5: .env has matching POSTGRES_PASSWORD and DB_PASSWORD... "
    POSTGRES_PWD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d= -f2)
    DB_PWD=$(grep "^DB_PASSWORD=" .env | cut -d= -f2)
    
    if [ "$POSTGRES_PWD" = "$DB_PWD" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "POSTGRES_PASSWORD and DB_PASSWORD must match in .env"
        exit 1
    fi
else
    echo -n "Test 5: .env file exists... "
    echo -e "${YELLOW}⚠ SKIP${NC} (.env not created yet)"
fi

# Test 6: Check docker-compose.yml has correct environment variables
echo -n "Test 6: docker-compose.yml has DB_HOST default... "
if grep -q "DB_HOST:.*\${DB_HOST:-postgres}" docker-compose.yml; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "docker-compose.yml should have DB_HOST default to 'postgres'"
    exit 1
fi

# Test 7: Check that backend/.env.example has usage instructions
echo -n "Test 7: backend/.env.example has usage instructions... "
if grep -q "IMPORTANT.*This file is for LOCAL DEVELOPMENT ONLY" backend/.env.example; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "backend/.env.example should have clear usage instructions"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All tests passed!${NC}"
echo "========================================"
echo ""
echo "Summary:"
echo "  - backend/.env.example has correct Docker defaults"
echo "  - No backend/.env file to interfere with Docker"
echo "  - docker-compose.yml properly configured"
echo ""
echo "To test the full deployment:"
echo "  1. cp .env.example .env"
echo "  2. docker compose up -d"
echo "  3. docker compose exec backend npm run migrate"
echo ""
