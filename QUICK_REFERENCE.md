# 📋 Quick Reference - GMAO

Essential commands and information for daily use of the GMAO application.

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/noeljp/GMAO.git
cd GMAO
./setup.sh

# Or manually
cp .env.example .env
docker compose up -d
docker compose exec backend npm run migrate
```

## 🔗 Access URLs

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | http://localhost:3010 | http://localhost or https://yourdomain.com |
| Backend API | http://localhost:5010 | http://localhost:5000 |
| Health Check | http://localhost:5010/health | http://localhost:5000/health |
| PostgreSQL | localhost:5432 | localhost:5432 (internal only) |

## 🔑 Default Credentials

**⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!**

- Email: `admin@gmao.com`
- Password: `Admin123!`

## 📦 Essential Commands

### Docker Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f
docker compose logs -f backend   # Backend only
docker compose logs -f frontend  # Frontend only

# Restart services
docker compose restart
docker compose restart backend   # Backend only

# View status
docker compose ps

# Rebuild images
docker compose build
docker compose up -d --build

# Clean restart (⚠️ removes data)
docker compose down -v
docker compose up -d
```

### Database Commands

```bash
# Run migrations
docker compose exec backend npm run migrate

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d gmao_db

# Backup database
docker compose exec postgres pg_dump -U postgres gmao_db > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres -d gmao_db < backup.sql

# Common SQL queries
docker compose exec postgres psql -U postgres -d gmao_db -c "SELECT COUNT(*) FROM utilisateurs;"
docker compose exec postgres psql -U postgres -d gmao_db -c "\dt"  # List tables
```

### Application Commands

```bash
# Backend commands
docker compose exec backend npm install package-name  # Install package
docker compose exec backend npm test                  # Run tests
docker compose exec backend npm audit                 # Check vulnerabilities
docker compose exec backend sh                        # Open shell

# Frontend commands
docker compose exec frontend npm install package-name
docker compose exec frontend sh
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Main configuration (passwords, secrets) |
| `docker-compose.yml` | Development orchestration |
| `docker-compose.prod.yml` | Production orchestration |
| `backend/.env.example` | Backend config template |
| `frontend/.env.example` | Frontend config template |

## 🐛 Troubleshooting Quick Fixes

### Port already in use
```bash
# Find and kill process
sudo lsof -i :3010
sudo lsof -i :5010
kill -9 <PID>
```

### Database connection error
```bash
# Check PostgreSQL health
docker compose ps postgres
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### Frontend can't connect to backend
```bash
# Check backend is running
curl http://localhost:5010/health

# Check frontend env
docker compose exec frontend env | grep API

# Restart frontend
docker compose restart frontend
```

### Rate limit exceeded (429)
```bash
# Wait 15 minutes or restart backend
docker compose restart backend
```

### Docker out of space
```bash
# Clean up Docker
docker system prune -a --volumes
```

## 📊 Common Tasks

### Change admin password

**Method 1: Through UI**
1. Login at http://localhost:3010
2. Click user icon → Profile
3. Change password

**Method 2: Database direct**
```bash
# Generate hash at https://bcrypt-generator.com/ (10 rounds)
docker compose exec postgres psql -U postgres -d gmao_db
UPDATE utilisateurs SET password = '$2b$10$NEW_HASH' WHERE email = 'admin@gmao.com';
```

### Create a new user

1. Login as admin
2. Navigate to "Utilisateurs"
3. Click "Créer un utilisateur"
4. Fill in details and assign role

### Add a new site

1. Navigate to "Sites"
2. Click "Créer un site"
3. Fill in site details
4. Add buildings and zones as needed

### Create a work order

1. Navigate to "Ordres de Travail"
2. Click "Créer un OT"
3. Select asset and maintenance type
4. Assign team and set priority

## 🔒 Security Checklist

Before production deployment:

- [ ] Changed admin password
- [ ] Generated secure JWT_SECRET (64+ chars)
- [ ] Updated database passwords
- [ ] Configured CORS_ORIGIN
- [ ] Enabled HTTPS
- [ ] Set NODE_ENV=production
- [ ] Configured backups
- [ ] Set up monitoring

## 📚 Documentation Links

- [Installation Guide](./INSTALLATION_FROM_SCRATCH.md)
- [Production Checklist](./CHECKLIST_PRODUCTION.md)
- [Security Guide](./SECURITE.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Complete README](./README.md)

## 🆘 Getting Help

1. Check documentation
2. Review logs: `docker compose logs`
3. Check GitHub issues
4. Read troubleshooting guide

## 📈 Monitoring

```bash
# Check resource usage
docker stats

# Check disk usage
docker system df

# View all containers
docker ps -a

# Check network
docker network ls
docker network inspect gmao_default
```

## 🔄 Updating

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Run new migrations
docker compose exec backend npm run migrate
```

---

**Pro Tip**: Bookmark this page for quick reference!

**Version**: 1.0  
**Last Updated**: January 2026
