@echo off
setlocal enabledelayedexpansion

REM GMAO - Installation and Run Script for Windows 11
REM This script automates the setup and launch of the GMAO application

REM Color codes for Windows (using PowerShell for colored output)
REM We'll use echo with color codes where possible

echo.
echo ========================================
echo GMAO - Installation Wizard for Windows 11
echo ========================================
echo.

REM Check if running with administrator privileges (optional, but recommended)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Not running as Administrator
    echo Some operations may fail. Consider running as Administrator.
    echo.
    timeout /t 3 /nobreak >nul
)

REM ========================================
REM Step 1: Check Prerequisites
REM ========================================
echo ========================================
echo Checking Prerequisites
echo ========================================
echo.

REM Check Docker Desktop
where docker >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo [OK] Docker found
docker --version
echo.

REM Check Docker Compose
docker compose version >nul 2>&1
if %errorLevel% neq 0 (
    docker-compose --version >nul 2>&1
    if %errorLevel% neq 0 (
        echo [ERROR] Docker Compose is not available
        echo Please make sure Docker Desktop is properly installed
        echo.
        pause
        exit /b 1
    )
    echo [OK] Docker Compose found (legacy version)
    docker-compose --version
    set COMPOSE_CMD=docker-compose
) else (
    echo [OK] Docker Compose found
    docker compose version
    set COMPOSE_CMD=docker compose
)
echo.

REM Check if Docker Desktop is running
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Docker Desktop is not running
    echo Please start Docker Desktop and wait for it to be ready
    echo.
    pause
    exit /b 1
)
echo [OK] Docker Desktop is running
echo.

REM ========================================
REM Step 2: Configuration Setup
REM ========================================
echo ========================================
echo Configuration Setup
echo ========================================
echo.

REM Check if .env exists
if exist .env (
    echo [WARNING] .env file already exists
    set /p "OVERWRITE=Do you want to overwrite it? (y/N): "
    if /i "!OVERWRITE!"=="y" (
        copy /y .env.example .env >nul
        echo [OK] Created new .env from template
    ) else (
        echo [INFO] Using existing .env file
    )
) else (
    if not exist .env.example (
        echo [ERROR] .env.example not found
        pause
        exit /b 1
    )
    copy .env.example .env >nul
    echo [OK] Created .env from template
)
echo.

REM ========================================
REM Step 3: Generate Secure Credentials
REM ========================================
echo ========================================
echo Generating Secure Credentials
echo ========================================
echo.

REM Generate secure passwords using PowerShell
echo [INFO] Generating secure passwords...

REM Generate PostgreSQL password
for /f "delims=" %%i in ('powershell -Command "[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })) -replace '[=+/]',''" ') do set POSTGRES_PASSWORD=%%i
set POSTGRES_PASSWORD=%POSTGRES_PASSWORD:~0,32%

REM Generate JWT secret (64 bytes hex = 128 characters)
for /f "delims=" %%i in ('powershell -Command "-join ((1..64 | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 256) }))"') do set JWT_SECRET=%%i

REM Update .env file using PowerShell for better text processing
powershell -Command "(Get-Content .env) -replace 'POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=%POSTGRES_PASSWORD%' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=%POSTGRES_PASSWORD%' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'JWT_SECRET=.*', 'JWT_SECRET=%JWT_SECRET%' | Set-Content .env"

echo [OK] Generated secure PostgreSQL password
echo [OK] Generated secure JWT secret
echo.

REM ========================================
REM Step 4: Environment Configuration
REM ========================================
echo ========================================
echo Environment Configuration
echo ========================================
echo.

set /p "IS_PROD=Is this for production? (y/N): "
if /i "!IS_PROD!"=="y" (
    powershell -Command "(Get-Content .env) -replace 'NODE_ENV=.*', 'NODE_ENV=production' | Set-Content .env"
    echo [WARNING] Production mode enabled
    echo [WARNING] Make sure to configure CORS_ORIGIN in .env for your domain!
    set COMPOSE_FILE=docker-compose.prod.yml
) else (
    echo [INFO] Development mode
    set COMPOSE_FILE=docker-compose.yml
)
echo.

REM ========================================
REM Step 5: Start Services
REM ========================================
echo ========================================
echo Starting Services
echo ========================================
echo.

echo [INFO] Pulling Docker images...
%COMPOSE_CMD% -f %COMPOSE_FILE% pull
echo.

echo [INFO] Building containers...
%COMPOSE_CMD% -f %COMPOSE_FILE% build
echo.

echo [INFO] Starting containers...
%COMPOSE_CMD% -f %COMPOSE_FILE% up -d
if %errorLevel% neq 0 (
    echo [ERROR] Failed to start containers
    echo Please check the Docker Desktop logs for details
    pause
    exit /b 1
)
echo [OK] Containers started
echo.

REM ========================================
REM Step 6: Wait for Services
REM ========================================
echo ========================================
echo Waiting for Services to be Ready
echo ========================================
echo.

echo [INFO] Waiting for PostgreSQL to be ready...
set COUNTER=0
set MAX_TRIES=30

:wait_postgres
%COMPOSE_CMD% -f %COMPOSE_FILE% exec -T postgres pg_isready -U postgres >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] PostgreSQL is ready
    goto postgres_ready
)
timeout /t 2 /nobreak >nul
set /a COUNTER+=1
if %COUNTER% geq %MAX_TRIES% (
    echo [ERROR] PostgreSQL failed to start
    echo Showing PostgreSQL logs:
    %COMPOSE_CMD% -f %COMPOSE_FILE% logs postgres
    pause
    exit /b 1
)
goto wait_postgres

:postgres_ready
echo.

echo [INFO] Waiting for backend to be ready...
set COUNTER=0
set MAX_TRIES=30

:wait_backend
REM Check if backend is responding to health check
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5010/health' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Backend is ready
    goto backend_ready
)
timeout /t 2 /nobreak >nul
set /a COUNTER+=1
if %COUNTER% geq %MAX_TRIES% (
    echo [WARNING] Backend health check timeout - will attempt migration anyway
    goto backend_ready
)
goto wait_backend

:backend_ready
echo.

REM ========================================
REM Step 7: Initialize Database
REM ========================================
echo ========================================
echo Initializing Database
echo ========================================
echo.

echo [INFO] Running database migrations...
%COMPOSE_CMD% -f %COMPOSE_FILE% exec -T backend npm run migrate
if %errorLevel% equ 0 (
    echo [OK] Database initialized successfully
) else (
    echo [ERROR] Database migration failed
    echo You may need to run manually: %COMPOSE_CMD% -f %COMPOSE_FILE% exec backend npm run migrate
)
echo.

REM ========================================
REM Step 8: Installation Complete
REM ========================================
echo ========================================
echo Installation Complete!
echo ========================================
echo.

echo [SUCCESS] GMAO is now running!
echo.

if "%COMPOSE_FILE%"=="docker-compose.yml" (
    echo Access the application:
    echo   Frontend:  http://localhost:3010
    echo   Backend:   http://localhost:5010
    echo   API Test:  http://localhost:5010/health
) else (
    echo Access the application:
    echo   Frontend:  http://localhost
    echo   Backend:   http://localhost:5000
)
echo.

echo Default Login Credentials:
echo   Email:    admin@gmao.com
echo   Password: Admin123!
echo.
echo [WARNING] IMPORTANT: Change the admin password after first login!
echo.

echo Container Status:
%COMPOSE_CMD% -f %COMPOSE_FILE% ps
echo.

echo Useful Commands:
echo   View logs:        %COMPOSE_CMD% -f %COMPOSE_FILE% logs -f
echo   Stop services:    %COMPOSE_CMD% -f %COMPOSE_FILE% down
echo   Restart:          %COMPOSE_CMD% -f %COMPOSE_FILE% restart
echo   View status:      %COMPOSE_CMD% -f %COMPOSE_FILE% ps
echo.

echo Installation completed successfully!
echo For more information, see: INSTALLATION_FROM_SCRATCH.md
echo.

REM Open the application in default browser (optional)
set /p "OPEN_BROWSER=Do you want to open the application in your browser? (Y/n): "
if /i "!OPEN_BROWSER!"=="n" (
    echo.
    echo You can access the application at http://localhost:3010
) else (
    echo.
    echo Opening application in browser...
    timeout /t 2 /nobreak >nul
    start http://localhost:3010
)

echo.
pause
