# 🗄️ Database Configuration Guide

## 🎯 How It Works

Flowise decides which database to use based on the `DATABASE_TYPE` variable:

```
If DATABASE_TYPE is set:
    → Use external database (PostgreSQL/MySQL/MariaDB)

If DATABASE_TYPE is NOT set (commented or empty):
    → Use SQLite (file-based)
```

---

## 📋 Configuration Scenarios

### Scenario 1: SQLite (Development/Testing Only)

**When to use:**
- Local development
- Quick testing
- Single-user setup
- **NOT for production!**

**Configuration:**

```bash
# Option 1: SQLite - Just set the path, don't set DATABASE_TYPE
DATABASE_PATH=/root/.flowise

# Comment out or remove DATABASE_TYPE
# DATABASE_TYPE=postgres  ← Keep this commented!
```

**Full .env example:**

```bash
############### SQLITE CONFIG ###############
# Only DATABASE_PATH is needed
DATABASE_PATH=/root/.flowise

# Leave DATABASE_TYPE commented out (this makes it use SQLite)
# DATABASE_TYPE=
# DATABASE_HOST=
# DATABASE_PORT=
# DATABASE_NAME=
# DATABASE_USER=
# DATABASE_PASSWORD=
```

**Result:** SQLite database file at `/root/.flowise/database.sqlite`

---

### Scenario 2: PostgreSQL (Production - Recommended)

**When to use:**
- Production environments
- Multi-worker setup (queue mode)
- High concurrent users
- Better performance & reliability

**Configuration:**

```bash
# Option 2: PostgreSQL - Set DATABASE_TYPE to postgres
DATABASE_PATH=/root/.flowise        # Still needed for other files
DATABASE_TYPE=postgres               # ← This triggers PostgreSQL
DATABASE_HOST=postgres               # or your PostgreSQL server IP/hostname
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=your-strong-password-here
```

**Full .env example:**

```bash
############### POSTGRESQL CONFIG ###############
# DATABASE_PATH still used for logs, secrets, storage
DATABASE_PATH=/root/.flowise

# Set DATABASE_TYPE to use PostgreSQL
DATABASE_TYPE=postgres
DATABASE_HOST=postgres              # For Docker: use service name
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=MySecurePass123!

# Optional: SSL for cloud databases (RDS, Cloud SQL)
# DATABASE_SSL=true
# DATABASE_REJECT_UNAUTHORIZED=true
# DATABASE_SSL_KEY_BASE64=<base64-cert>
```

**Result:** Connects to external PostgreSQL server

---

### Scenario 3: MySQL/MariaDB (Production Alternative)

**When to use:**
- If you prefer MySQL ecosystem
- Existing MySQL infrastructure
- Alternative to PostgreSQL

**Configuration:**

```bash
# Option 3: MySQL/MariaDB - Set DATABASE_TYPE to mysql or mariadb
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=mysql                  # or: mariadb
DATABASE_HOST=mysql-server
DATABASE_PORT=3306
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=your-strong-password-here
```

**Full .env example:**

```bash
############### MYSQL CONFIG ###############
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=mysql                 # or mariadb
DATABASE_HOST=mysql-server
DATABASE_PORT=3306
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=MySecurePass123!

# Optional: SSL
# DATABASE_SSL=true
```

---

## 🔍 Key Points to Understand

### 1. **DATABASE_PATH is always needed**

```bash
# This path is used for:
DATABASE_PATH=/root/.flowise

# ✓ SQLite database file (if DATABASE_TYPE not set)
# ✓ Encryption keys
# ✓ Uploaded files
# ✓ Logs
# ✓ Temporary storage

# It's NOT just for SQLite!
```

### 2. **DATABASE_TYPE determines the database system**

```bash
# Not set or commented → SQLite
# DATABASE_TYPE=postgres → PostgreSQL
# DATABASE_TYPE=mysql → MySQL
# DATABASE_TYPE=mariadb → MariaDB
```

### 3. **External DB requires all connection params**

```bash
# When DATABASE_TYPE is set, you MUST provide:
DATABASE_TYPE=postgres
DATABASE_HOST=your-host     # Required
DATABASE_PORT=5432          # Required
DATABASE_NAME=flowise       # Required
DATABASE_USER=flowise       # Required
DATABASE_PASSWORD=pass      # Required
```

---

## 📝 Configuration Templates

### Template 1: Local Development (SQLite)

```bash
# .env.queue-source.local
PORT=3000
WORKER_PORT=5566

# SQLite configuration (simple, for dev only)
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Leave commented or empty

SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs
BLOB_STORAGE_PATH=/root/.flowise/storage

# Queue mode with Redis
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379

# ... other configs
```

### Template 2: Production with Docker PostgreSQL

```bash
# .env.queue-source.local
PORT=3000
WORKER_PORT=5566

# PostgreSQL configuration
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=postgres          # Docker service name
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=YourStrongPassword123!

SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs
BLOB_STORAGE_PATH=/root/.flowise/storage

# Queue mode
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379

# ... other configs
```

**Requires docker-compose.override.yml:**

```yaml
version: '3.1'

services:
  postgres:
    image: postgres:16-alpine
    container_name: flowise-postgres
    restart: always
    environment:
      POSTGRES_DB: flowise
      POSTGRES_USER: flowise
      POSTGRES_PASSWORD: YourStrongPassword123!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - flowise-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flowise"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

### Template 3: Production with External PostgreSQL (RDS, Cloud SQL)

```bash
# .env.queue-source.local
PORT=3000
WORKER_PORT=5566

# External PostgreSQL (AWS RDS, GCP Cloud SQL, etc.)
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=your-db-instance.abc123.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=VeryStrongPassword123!

# SSL for cloud databases
DATABASE_SSL=true
DATABASE_REJECT_UNAUTHORIZED=true
# DATABASE_SSL_KEY_BASE64=<base64-encoded-certificate>

SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs

# Use S3 for storage (recommended with multiple workers)
STORAGE_TYPE=s3
S3_STORAGE_BUCKET_NAME=my-flowise-bucket
S3_STORAGE_REGION=us-east-1
S3_STORAGE_ACCESS_KEY_ID=AKIA...
S3_STORAGE_SECRET_ACCESS_KEY=...

# Queue mode
MODE=queue
QUEUE_NAME=flowise-queue

# External Redis (ElastiCache, Redis Cloud)
REDIS_URL=redis://your-redis-instance:6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# ... other configs
```

---

## ⚠️ Common Mistakes

### ❌ Mistake 1: Setting DATABASE_TYPE but missing connection params

```bash
# WRONG - This will fail!
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
# Missing: HOST, PORT, NAME, USER, PASSWORD
```

**Error:** "Unable to connect to database"

### ❌ Mistake 2: Setting both SQLite and PostgreSQL

```bash
# CONFUSING - Which one will be used?
DATABASE_PATH=/root/.flowise          # SQLite path
DATABASE_TYPE=postgres                # But type is postgres!
DATABASE_HOST=localhost
# ...
```

**Result:** PostgreSQL is used (DATABASE_TYPE takes priority)

### ❌ Mistake 3: Wrong Docker service name

```bash
# WRONG - Service name doesn't match docker-compose
DATABASE_TYPE=postgres
DATABASE_HOST=localhost               # ❌ Wrong!
# Should be: DATABASE_HOST=postgres   # ✅ Correct (service name)
```

**Error:** "Connection refused"

### ❌ Mistake 4: Using SQLite in production with workers

```bash
# BAD PRACTICE - SQLite with multiple workers
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE not set → SQLite
MODE=queue
WORKER_CONCURRENCY=10
```

**Problem:** SQLite locks on concurrent writes = slow/errors

---

## ✅ Recommended Configurations

### Development (Local Machine)

```bash
# Simple SQLite
DATABASE_PATH=/root/.flowise
# Don't set DATABASE_TYPE

# Or with Docker PostgreSQL for testing
DATABASE_TYPE=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=dev123
```

### Production (Small Scale)

```bash
# PostgreSQL (Docker or external)
DATABASE_TYPE=postgres
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=strong-password

# Single main server + 2-3 workers
MODE=queue
WORKER_CONCURRENCY=10
```

### Production (Large Scale)

```bash
# External PostgreSQL (managed service)
DATABASE_TYPE=postgres
DATABASE_HOST=rds-instance.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=very-strong-password
DATABASE_SSL=true

# S3 storage (multiple workers need shared storage)
STORAGE_TYPE=s3
S3_STORAGE_BUCKET_NAME=flowise-prod

# Redis cluster
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=redis-password

# Multiple workers
MODE=queue
WORKER_CONCURRENCY=20
```

---

## 🔧 Testing Your Configuration

### Test 1: Check Which Database is Used

```bash
# Start containers
./deploy-queue-source.sh start

# Check logs for database connection
docker logs flowise-main 2>&1 | grep -i "database\|data source"

# You should see:
# ✓ "Data Source initialized successfully"
```

### Test 2: Verify Database Type

```bash
# Access container
docker exec -it flowise-main sh

# Check environment
env | grep DATABASE

# Should show your configuration
```

### Test 3: Test Database Connection

```bash
# For PostgreSQL/MySQL
docker exec flowise-main curl http://localhost:3000/api/v1/ping

# Should return: {"status":"ok"}
```

### Test 4: Check SQLite File (if using SQLite)

```bash
# List files in DATABASE_PATH
docker exec flowise-main ls -la /root/.flowise/

# Should see: database.sqlite
```

---

## 🚀 Quick Start Examples

### Quick Start 1: SQLite (Fastest for Testing)

```bash
cd docker
cp .env.queue-source .env.queue-source.local

# Edit - keep it simple
nano .env.queue-source.local
```

**Minimal config:**

```bash
PORT=3000
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Leave empty/commented

MODE=queue
REDIS_URL=redis://redis:6379

JWT_AUTH_TOKEN_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
```

```bash
# Deploy
./deploy-queue-source.sh start
```

### Quick Start 2: PostgreSQL (Production Ready)

```bash
cd docker

# Create docker-compose.override.yml (add PostgreSQL)
cat > docker-compose.override.yml << 'EOF'
version: '3.1'
services:
  postgres:
    image: postgres:16-alpine
    container_name: flowise-postgres
    environment:
      POSTGRES_DB: flowise
      POSTGRES_USER: flowise
      POSTGRES_PASSWORD: ChangeMeInProduction123!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - flowise-net
volumes:
  postgres_data:
EOF

# Edit .env
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local
```

**Config:**

```bash
PORT=3000
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=ChangeMeInProduction123!

MODE=queue
REDIS_URL=redis://redis:6379

JWT_AUTH_TOKEN_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
```

```bash
# Deploy
./deploy-queue-source.sh start
```

---

## 📊 Summary Table

| Scenario | DATABASE_TYPE | DATABASE_PATH | Other DB Vars | Use Case |
|----------|---------------|---------------|---------------|----------|
| SQLite | Not set / commented | ✅ Required | ❌ Not needed | Dev/Testing |
| PostgreSQL | `postgres` | ✅ Required* | ✅ All required | Production |
| MySQL | `mysql` | ✅ Required* | ✅ All required | Production |
| MariaDB | `mariadb` | ✅ Required* | ✅ All required | Production |

*\*Required for storing non-database files (logs, uploads, keys)*

---

## 🎯 Final Recommendation

**Development:**
```bash
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Leave empty for SQLite
```

**Production:**
```bash
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres              # Choose postgres/mysql/mariadb
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=strong-password
```

**Always set DATABASE_PATH regardless of database type!**
