#!/bin/bash

# Script de correction pour l'erreur "Cannot find module 'mqtt'"
# Ce script reconstruit les conteneurs Docker et réinstalle les dépendances

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GMAO - Correction de l'erreur MQTT${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Vérifier que Docker Compose est disponible
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose n'est pas installé${NC}"
    exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo -e "${YELLOW}Cette opération va :${NC}"
echo -e "  1. Arrêter les conteneurs en cours"
echo -e "  2. Supprimer le volume node_modules"
echo -e "  3. Reconstruire les images Docker"
echo -e "  4. Redémarrer les services"
echo -e "\n${YELLOW}Voulez-vous continuer ? (o/N)${NC}"
read -n 1 -r
echo
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo -e "${BLUE}Opération annulée${NC}"
    exit 0
fi

# Étape 1 : Arrêter les services
echo -e "\n${BLUE}[1/5] Arrêt des services...${NC}"
$COMPOSE_CMD down
echo -e "${GREEN}✓ Services arrêtés${NC}"

# Étape 2 : Supprimer le volume node_modules
echo -e "\n${BLUE}[2/5] Suppression du volume node_modules...${NC}"
if docker volume ls | grep -q "gmao_backend_node_modules"; then
    docker volume rm gmao_backend_node_modules
    echo -e "${GREEN}✓ Volume supprimé${NC}"
else
    echo -e "${YELLOW}⚠ Volume non trouvé (déjà supprimé)${NC}"
fi

# Étape 3 : Reconstruire l'image backend
echo -e "\n${BLUE}[3/5] Reconstruction de l'image backend...${NC}"
$COMPOSE_CMD build --no-cache backend
echo -e "${GREEN}✓ Image reconstruite${NC}"

# Étape 4 : Démarrer les services
echo -e "\n${BLUE}[4/5] Démarrage des services...${NC}"
$COMPOSE_CMD up -d
echo -e "${GREEN}✓ Services démarrés${NC}"

# Étape 5 : Vérifier que le backend démarre correctement
echo -e "\n${BLUE}[5/5] Vérification du backend...${NC}"
echo -e "${YELLOW}Attente du démarrage du backend (max 60s)...${NC}"

COUNTER=0
MAX_TRIES=30
while [ $COUNTER -lt $MAX_TRIES ]; do
    if $COMPOSE_CMD logs backend 2>&1 | grep -q "Server running"; then
        echo -e "${GREEN}✓ Backend démarré avec succès${NC}"
        break
    fi
    
    if $COMPOSE_CMD logs backend 2>&1 | grep -q "Cannot find module"; then
        echo -e "${RED}✗ Erreur : Le module manque toujours${NC}"
        echo -e "${YELLOW}Tentative de réinstallation manuelle...${NC}"
        $COMPOSE_CMD exec backend npm install
        $COMPOSE_CMD restart backend
        sleep 5
        break
    fi
    
    sleep 2
    COUNTER=$((COUNTER + 1))
    echo -n "."
done
echo

if [ $COUNTER -ge $MAX_TRIES ]; then
    echo -e "${YELLOW}⚠ Timeout - vérifiez les logs manuellement${NC}"
    echo -e "${BLUE}Commande: docker-compose logs backend${NC}"
fi

# Afficher les logs récents
echo -e "\n${BLUE}Logs récents du backend :${NC}"
$COMPOSE_CMD logs --tail=20 backend

# Afficher le statut
echo -e "\n${BLUE}Statut des services :${NC}"
$COMPOSE_CMD ps

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Correction terminée !${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${BLUE}Services disponibles :${NC}"
echo -e "  Frontend:  http://localhost:3010"
echo -e "  Backend:   http://localhost:5010"
echo -e "  Health:    http://localhost:5010/health"
echo -e "\n${YELLOW}Si le problème persiste, consultez TROUBLESHOOTING.md${NC}\n"
