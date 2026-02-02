@echo off
REM Script de correction pour l'erreur "Cannot find module 'mqtt'"
REM Ce script reconstruit les conteneurs Docker et reinstalle les dependances

setlocal enabledelayedexpansion

echo ========================================
echo GMAO - Correction de l'erreur MQTT
echo ========================================
echo.

REM Verifier que Docker Compose est disponible
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    docker-compose --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERREUR] Docker Compose n'est pas installe
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker-compose
) else (
    set COMPOSE_CMD=docker compose
)

echo Cette operation va :
echo   1. Arreter les conteneurs en cours
echo   2. Supprimer le volume node_modules
echo   3. Reconstruire les images Docker
echo   4. Redemarrer les services
echo.
set /p REPLY="Voulez-vous continuer ? (o/N): "
if /i not "%REPLY%"=="o" if /i not "%REPLY%"=="y" (
    echo Operation annulee
    pause
    exit /b 0
)

REM Etape 1 : Arreter les services
echo.
echo [1/5] Arret des services...
%COMPOSE_CMD% down
if %errorlevel% equ 0 (
    echo [OK] Services arretes
) else (
    echo [ERREUR] Echec de l'arret des services
    pause
    exit /b 1
)

REM Etape 2 : Supprimer le volume node_modules
echo.
echo [2/5] Suppression du volume node_modules...
docker volume ls | findstr "gmao_backend_node_modules" >nul 2>&1
if %errorlevel% equ 0 (
    docker volume rm gmao_backend_node_modules
    if %errorlevel% equ 0 (
        echo [OK] Volume supprime
    ) else (
        echo [ATTENTION] Echec de la suppression du volume
    )
) else (
    echo [ATTENTION] Volume non trouve (deja supprime)
)

REM Etape 3 : Reconstruire l'image backend
echo.
echo [3/5] Reconstruction de l'image backend...
%COMPOSE_CMD% build --no-cache backend
if %errorlevel% equ 0 (
    echo [OK] Image reconstruite
) else (
    echo [ERREUR] Echec de la reconstruction
    pause
    exit /b 1
)

REM Etape 4 : Demarrer les services
echo.
echo [4/5] Demarrage des services...
%COMPOSE_CMD% up -d
if %errorlevel% equ 0 (
    echo [OK] Services demarres
) else (
    echo [ERREUR] Echec du demarrage
    pause
    exit /b 1
)

REM Etape 5 : Verifier que le backend demarre correctement
echo.
echo [5/5] Verification du backend...
echo Attente du demarrage du backend (max 60s)...

set COUNTER=0
set MAX_TRIES=30
:wait_loop
if %COUNTER% geq %MAX_TRIES% goto wait_timeout

%COMPOSE_CMD% logs backend 2>&1 | findstr "Server running" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend demarre avec succes
    goto wait_done
)

%COMPOSE_CMD% logs backend 2>&1 | findstr "Cannot find module" >nul 2>&1
if %errorlevel% equ 0 (
    echo [ERREUR] Le module manque toujours
    echo Tentative de reinstallation manuelle...
    %COMPOSE_CMD% exec backend npm install
    %COMPOSE_CMD% restart backend
    timeout /t 5 >nul
    goto wait_done
)

timeout /t 2 >nul
set /a COUNTER+=1
echo .
goto wait_loop

:wait_timeout
echo [ATTENTION] Timeout - verifiez les logs manuellement
echo Commande: %COMPOSE_CMD% logs backend

:wait_done

REM Afficher les logs recents
echo.
echo Logs recents du backend :
%COMPOSE_CMD% logs --tail=20 backend

REM Afficher le statut
echo.
echo Statut des services :
%COMPOSE_CMD% ps

echo.
echo ========================================
echo Correction terminee !
echo ========================================
echo.
echo Services disponibles :
echo   Frontend:  http://localhost:3010
echo   Backend:   http://localhost:5010
echo   Health:    http://localhost:5010/health
echo.
echo Si le probleme persiste, consultez TROUBLESHOOTING.md
echo.
pause
