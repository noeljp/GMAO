#!/bin/bash
# Script pour corriger le problème de modules manquants dans le backend Docker

echo "🔧 Correction du problème node_modules dans le backend..."

echo "1. Installation des dépendances dans le conteneur..."
docker exec gmao-backend sh -c "cd /app && npm install"

echo "2. Redémarrage de nodemon..."
docker exec gmao-backend sh -c "pkill -f nodemon || true"

echo "3. Attente du redémarrage..."
sleep 3

echo "4. Vérification des logs..."
docker logs gmao-backend --tail 10

echo "✅ Terminé ! Le backend devrait maintenant fonctionner."
echo "   Accédez à http://localhost:3000 pour tester."
