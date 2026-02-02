# Troubleshooting: PostgreSQL Authentication Error

## ❌ Error Message

```
Error starting MQTT service: password authentication failed for user "postgres"
error: password authentication failed for user "postgres"
```

## 🔍 Common Causes

### 1. Missing .env File

**Symptom:** Environment variables are undefined

**Solution:**
```bash
# Create .env file from template
cp .env.example .env
```

**Verify the file was created:**
```bash
ls -la .env
```

### 2. Incorrect Password Configuration

**Symptom:** POSTGRES_PASSWORD and DB_PASSWORD don't match

**Check your configuration:**
```bash
grep "PASSWORD" .env
```

**Expected output:**
```
POSTGRES_PASSWORD=postgres
DB_PASSWORD=postgres
```

**⚠️ IMPORTANT:** These two values **MUST** be identical!

**Fix if needed:**
```bash
# Edit .env and ensure both passwords match
nano .env  # or use your preferred editor
```

### 3. Conflicting backend/.env File

**Symptom:** Works locally but fails in Docker

**Check if the file exists:**
```bash
ls -la backend/.env
```

**⚠️ If the file exists with Docker, DELETE it:**
```bash
rm backend/.env
```

**Why?** When using Docker Compose, the `backend/.env` file overrides environment variables passed by Docker, causing connection failures.

### 4. PostgreSQL Container Not Ready

**Symptom:** Intermittent failures on startup

**Check container status:**
```bash
docker compose ps
```

**Check logs:**
```bash
docker compose logs postgres
```

**Solution:** The code now includes automatic retry logic (5 attempts with 2-second delays). If you still see errors, wait a few seconds and check if the service eventually connects.

### 5. Database Container Using Different Credentials

**Symptom:** Error persists even after fixing .env

**Solution - Full Reset:**
```bash
# Stop all containers
docker compose down

# Remove volumes (⚠️ This will delete all data!)
docker compose down -v

# Recreate everything with new credentials
docker compose up -d

# Check logs
docker compose logs -f backend
```

## 🔧 Step-by-Step Fix

### For Docker Compose (Recommended)

1. **Verify .env file exists at project root:**
   ```bash
   cd /home/runner/work/GMAO/GMAO
   ls -la .env
   ```

2. **If missing, create it:**
   ```bash
   cp .env.example .env
   ```

3. **Verify passwords match:**
   ```bash
   cat .env | grep -E "^POSTGRES_PASSWORD=|^DB_PASSWORD="
   ```
   
   Both should show the same password (default: `postgres`)

4. **Ensure NO backend/.env file exists:**
   ```bash
   ls backend/.env 2>/dev/null && rm backend/.env || echo "✓ OK"
   ```

5. **Restart containers:**
   ```bash
   docker compose down
   docker compose up -d
   ```

6. **Monitor logs:**
   ```bash
   docker compose logs -f backend
   ```
   
   You should see:
   - `Database connection successful`
   - `MQTT Service started with X broker(s)` or `MQTT Service started with 0 broker(s)` (if no brokers configured)

### For Local Development (Without Docker)

1. **Create backend/.env:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit backend/.env:**
   ```bash
   nano .env
   ```
   
   Change these values:
   ```
   DB_HOST=localhost  # Change from "postgres"
   CORS_ORIGIN=http://localhost:3000  # Change from port 3010
   ```

3. **Ensure PostgreSQL is running locally:**
   ```bash
   # On Linux/Mac
   sudo systemctl status postgresql
   
   # On Windows
   # Check if PostgreSQL service is running in Services
   ```

4. **Verify credentials match your local PostgreSQL:**
   ```bash
   # Try connecting manually
   psql -h localhost -U postgres -d gmao_db
   ```

## 🧪 Verification

### Test Database Connection

The application now validates database connection on startup. If you see these logs, everything is working:

```
✓ Database connection successful
✓ MQTT Service started with X broker(s)
```

### Manual Test

Run this inside the backend container:
```bash
docker compose exec backend node -e "
const pool = require('./src/config/database');
pool.query('SELECT 1').then(() => {
  console.log('✓ Database connection OK');
  process.exit(0);
}).catch(err => {
  console.error('✗ Database connection failed:', err.message);
  process.exit(1);
});
"
```

## 📋 Quick Checklist

- [ ] `.env` file exists at project root
- [ ] `POSTGRES_PASSWORD` = `DB_PASSWORD` in `.env`
- [ ] No `backend/.env` file exists (when using Docker)
- [ ] PostgreSQL container is running and healthy
- [ ] Backend container can connect to PostgreSQL

## 🆘 Still Having Issues?

### Check Environment Variables in Container

```bash
docker compose exec backend env | grep DB_
```

**Expected output:**
```
DB_HOST=postgres
DB_PORT=5432
DB_NAME=gmao_db
DB_USER=postgres
DB_PASSWORD=postgres
```

If any value is missing or incorrect, check your `.env` file and restart:
```bash
docker compose restart backend
```

### Check PostgreSQL Logs

```bash
docker compose logs postgres | grep -i error
```

Look for authentication-related errors or connection issues.

### Nuclear Option: Complete Reset

⚠️ **WARNING:** This will delete ALL data!

```bash
# Stop and remove everything
docker compose down -v

# Remove any orphaned containers
docker container prune -f

# Recreate .env
rm .env
cp .env.example .env

# Start fresh
docker compose up -d

# Monitor
docker compose logs -f
```

## 📚 Related Documentation

- [FIX_AUTH_POSTGRESQL.md](./FIX_AUTH_POSTGRESQL.md) - Detailed fix explanation
- [INSTALLATION.md](./INSTALLATION.md) - Installation guide
- [README.md](./README.md) - Project overview

## 🔐 Security Note

**For Production:**
- Never commit `.env` files to version control
- Generate strong passwords: `openssl rand -base64 32`
- Generate secure JWT secret: `openssl rand -hex 64`
- Use different credentials for each environment

**Current defaults are for DEVELOPMENT ONLY!**

---

**Last Updated:** February 2, 2026  
**Improved:** Added connection retry logic and better error messages
