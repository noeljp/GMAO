# 🚀 GMAO - Installation From Scratch Guide

Complete guide for installing and running the GMAO (Gestion de Maintenance Assistée par Ordinateur) application from a fresh clone.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Production Deployment](#production-deployment)
4. [Configuration](#configuration)
5. [Troubleshooting](#troubleshooting)
6. [First Steps After Installation](#first-steps-after-installation)

---

## Prerequisites

### Required Software

- **Docker** (24.0+) and **Docker Compose** (2.0+)
- **Git** (2.30+)

### Optional (for local development without Docker)

- **Node.js** 18+ LTS
- **PostgreSQL** 15+
- **npm** 10+

### System Requirements

- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk**: 10 GB free space
- **OS**: Linux, macOS, or Windows 10/11 with WSL2

---

## Quick Start (Development)

Perfect for developers who want to run the application locally with hot-reload.

### Step 1: Clone the Repository

```bash
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

### Step 2: Create Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your preferences
# IMPORTANT: Change default passwords!
nano .env  # or use your preferred editor
```

**Minimum required changes in `.env`:**
```bash
POSTGRES_PASSWORD=your_secure_password_here
DB_PASSWORD=your_secure_password_here
JWT_SECRET=$(openssl rand -hex 32)  # Generate a random secret
```

### Step 3: Start the Application

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker compose up -d

# Wait for services to be ready (30-45 seconds)
docker compose ps
```

Expected output:
```
NAME               IMAGE            STATUS          PORTS
gmao-postgres      postgres:15      Up (healthy)    0.0.0.0:5432->5432/tcp
gmao-backend       gmao-backend     Up              0.0.0.0:5010->5000/tcp
gmao-frontend      gmao-frontend    Up (healthy)    0.0.0.0:3010->3000/tcp
```

### Step 4: Initialize the Database

```bash
# Run database migrations (creates tables and seed data)
docker compose exec backend npm run migrate
```

Expected output:
```
✅ Schema created successfully
✅ Seed data inserted successfully
✅ Database migrations completed
```

### Step 5: Access the Application

- **Frontend**: http://localhost:3010
- **Backend API**: http://localhost:5010
- **API Health Check**: http://localhost:5010/health

**Default Login Credentials:**
- Email: `admin@gmao.com`
- Password: `Admin123!`

⚠️ **IMPORTANT**: Change these credentials immediately after first login!

---

## Production Deployment

For production environments with optimized builds and security hardening.

### Step 1: Clone and Configure

```bash
git clone https://github.com/noeljp/GMAO.git
cd GMAO
```

### Step 2: Create Production Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit for production - CRITICAL SECURITY STEP
nano .env
```

**Required production configuration:**

```bash
# Database - Use strong passwords!
POSTGRES_USER=gmao_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=gmao_db

# Backend
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_NAME=gmao_db
DB_USER=gmao_user
DB_PASSWORD=<same as POSTGRES_PASSWORD>

# JWT - Generate a strong secret
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=24h

# CORS - Set to your production domain
CORS_ORIGIN=https://yourdomain.com
```

### Step 3: Build and Deploy

```bash
# Start production services
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
docker compose -f docker-compose.prod.yml ps

# Initialize database
docker compose -f docker-compose.prod.yml exec backend npm run migrate
```

### Step 4: Secure the Installation

```bash
# Change default admin password
docker compose -f docker-compose.prod.yml exec postgres psql -U gmao_user -d gmao_db

# In psql:
-- Generate new password hash at: https://bcrypt-generator.com/ (10 rounds)
UPDATE utilisateurs 
SET password = '$2b$10$YOUR_NEW_HASH_HERE' 
WHERE email = 'admin@gmao.com';
\q
```

### Step 5: Configure Reverse Proxy (Recommended)

Use Nginx or Traefik for HTTPS termination:

```nginx
# /etc/nginx/sites-available/gmao
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Configuration

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_USER` | PostgreSQL username | postgres | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | postgres | **Yes (change!)** |
| `POSTGRES_DB` | Database name | gmao_db | Yes |
| `NODE_ENV` | Environment mode | development | Yes |
| `JWT_SECRET` | JWT signing secret | (example) | **Yes (change!)** |
| `JWT_EXPIRES_IN` | JWT expiration | 24h | No |
| `CORS_ORIGIN` | Allowed origin | http://localhost:3010 | Yes |
| `DB_HOST` | Database host | postgres | Yes |
| `DB_PORT` | Database port | 5432 | Yes |
| `DB_NAME` | Database name | gmao_db | Yes |
| `DB_USER` | DB username | postgres | Yes |
| `DB_PASSWORD` | DB password | postgres | **Yes (change!)** |

### Port Mapping

| Service | Container Port | Host Port (Dev) | Host Port (Prod) |
|---------|----------------|-----------------|------------------|
| Frontend | 3000 | 3010 | 80 |
| Backend | 5000 | 5010 | 5000 |
| PostgreSQL | 5432 | 5432 | 5432 |

**Note**: Development uses different host ports (3010, 5010) to avoid conflicts with existing services.

---

## Troubleshooting

### Issue: Containers won't start

**Symptoms:**
```bash
docker compose ps
# Shows containers in "Restarting" or "Exit" status
```

**Solution:**
```bash
# Check logs
docker compose logs backend
docker compose logs postgres

# Common fixes:
# 1. Port already in use
sudo ss -tulpn | grep -E ':(3010|5010|5432)'
# Kill conflicting process or change port in docker-compose.yml

# 2. Database not ready
# Wait longer for PostgreSQL health check
docker compose logs postgres | grep "ready to accept connections"

# 3. Clean restart
docker compose down -v
docker compose up -d
```

### Issue: "Cannot connect to database"

**Symptoms:**
```
Error: Connection refused
ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# 1. Check PostgreSQL is healthy
docker compose ps postgres

# 2. Verify connection inside container
docker compose exec backend sh
nc -zv postgres 5432

# 3. Check environment variables
docker compose exec backend env | grep DB_

# 4. Restart services
docker compose restart postgres backend
```

### Issue: Frontend shows "Network Error" or "ERR_CONNECTION_REFUSED"

**Symptoms:**
- Frontend loads but can't reach API
- Login fails with network error

**Solution:**
```bash
# 1. Check REACT_APP_API_URL
# For Docker dev, should be: http://localhost:5010
# NOT: http://backend:5000 (that's internal Docker network)

# 2. Verify backend is running
curl http://localhost:5010/health

# 3. Check browser console for errors
# Open DevTools (F12) → Console tab

# 4. Fix: Update frontend/.env
echo "REACT_APP_API_URL=http://localhost:5010" > frontend/.env
docker compose restart frontend
```

### Issue: "Rate limit exceeded" (429 error)

**Symptoms:**
```
Error: Too many requests, please try again later
```

**Solution:**
```bash
# Wait 15 minutes, or restart backend to reset
docker compose restart backend

# For development, you can disable rate limiting:
# Edit backend/src/server.js and comment out rate limiting middleware
```

### Issue: Migration fails

**Symptoms:**
```
Error: relation "utilisateurs" already exists
```

**Solution:**
```bash
# Option 1: Reset database (⚠️ DESTROYS ALL DATA)
docker compose down -v
docker compose up -d
sleep 30
docker compose exec backend npm run migrate

# Option 2: Manual fix
docker compose exec postgres psql -U postgres -d gmao_db
# Check what tables exist
\dt
# Drop conflicting tables if needed
```

### Issue: Port 3010 or 5010 already in use

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :3010
sudo lsof -i :5010

# Kill the process (replace PID)
kill -9 <PID>

# Or change ports in docker-compose.yml
# Edit ports section:
ports:
  - "3020:3000"  # Use 3020 instead of 3010
```

### Issue: Docker out of disk space

**Symptoms:**
```
Error: no space left on device
```

**Solution:**
```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a --volumes
# ⚠️ This removes ALL unused images and volumes

# Or clean selectively
docker image prune -a
docker volume prune
docker container prune
```

---

## First Steps After Installation

### 1. Login to the Application

Navigate to http://localhost:3010 (dev) or your production domain.

**Default credentials:**
- Email: `admin@gmao.com`
- Password: `Admin123!`

### 2. Change Admin Password

1. Click on your user icon (top right)
2. Go to "Profil"
3. Update password
4. Save changes

### 3. Create Your Organization

1. Navigate to "Sites"
2. Create your first site/location
3. Add buildings and zones as needed

### 4. Add Users and Teams

1. Go to "Utilisateurs"
2. Click "Créer un utilisateur"
3. Assign roles and teams

### 5. Configure Assets

1. Navigate to "Actifs"
2. Create asset types (machines, equipment)
3. Add your assets to locations

### 6. Setup Maintenance

1. Go to "Ordres de Travail"
2. Create work order templates
3. Set up preventive maintenance schedules

---

## Useful Commands

### Docker Management

```bash
# View logs
docker compose logs -f backend        # Follow backend logs
docker compose logs --tail=100        # Last 100 lines all services

# Restart services
docker compose restart backend        # Restart backend only
docker compose restart                # Restart all services

# Stop services
docker compose stop                   # Stop (data persists)
docker compose down                   # Stop and remove containers
docker compose down -v                # Stop and remove data (⚠️ DESTRUCTIVE)

# Rebuild images
docker compose build                  # Rebuild all
docker compose build backend          # Rebuild backend only
docker compose up -d --build          # Rebuild and restart

# Execute commands in containers
docker compose exec backend npm install  # Install npm package
docker compose exec backend sh          # Open shell in backend
docker compose exec postgres psql -U postgres  # PostgreSQL CLI

# Health status
docker compose ps                     # Status of all services
docker compose top                    # Process list
docker stats                          # Resource usage
```

### Database Management

```bash
# Backup database
docker compose exec postgres pg_dump -U postgres gmao_db > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U postgres -d gmao_db < backup_20240128.sql

# Connect to database
docker compose exec postgres psql -U postgres -d gmao_db

# Reset database (⚠️ DESTROYS ALL DATA)
docker compose down -v
docker compose up -d
docker compose exec backend npm run migrate
```

### Development

```bash
# Install new npm package (backend)
docker compose exec backend npm install package-name

# Run tests
docker compose exec backend npm test

# Check for vulnerabilities
docker compose exec backend npm audit
docker compose exec frontend npm audit
```

---

## Additional Resources

- **Main README**: [README.md](./README.md)
- **Complete Installation Guide**: [INSTALLATION_COMPLET.md](./INSTALLATION_COMPLET.md)
- **Security Guide**: [SECURITE.md](./SECURITE.md)
- **Production Checklist**: [CHECKLIST_PRODUCTION.md](./CHECKLIST_PRODUCTION.md)
- **Architecture Documentation**: [VISUAL_ARCHITECTURE.md](./VISUAL_ARCHITECTURE.md)

---

## Support

If you encounter issues not covered in this guide:

1. Check existing documentation in the repository
2. Review Docker logs for error messages
3. Check the GitHub Issues page
4. Ensure all prerequisites are met
5. Verify your `.env` configuration

---

## Security Checklist

Before going to production:

- [ ] Changed default admin password
- [ ] Generated strong JWT_SECRET (64+ characters)
- [ ] Updated database passwords
- [ ] Configured CORS_ORIGIN to your domain
- [ ] Enabled HTTPS with valid SSL certificate
- [ ] Set NODE_ENV=production
- [ ] Configured firewall (allow only 80/443)
- [ ] Set up automated database backups
- [ ] Enabled monitoring and logging
- [ ] Reviewed and applied [CHECKLIST_PRODUCTION.md](./CHECKLIST_PRODUCTION.md)

---

**Version**: 3.0  
**Last Updated**: January 2026  
**Tested with**: Docker 24.0.7, Docker Compose 2.23.3, Node.js 18.19  

**License**: MIT
