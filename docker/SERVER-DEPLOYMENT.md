# 🚀 Server Deployment Guide

## Quick Deploy (5 Steps)

### 1️⃣ Navigate to docker folder

```bash
cd ~/Flowise/docker  # Adjust path to your clone location
```

### 2️⃣ Create environment file

```bash
cp .env.queue-source .env.queue-source.local
```

### 3️⃣ Edit configuration

```bash
nano .env.queue-source.local
```

### 4️⃣ Minimum Configuration

**Essential settings to change:**

#### A) Choose Database Type

**Option A: SQLite (Quick test - NOT for production)**
```bash
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Leave commented or empty
```

**Option B: PostgreSQL (Production - RECOMMENDED)**
```bash
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=postgres        # or your PostgreSQL server IP
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=ChangeThisPassword123!
```

#### B) Generate & Set Secrets (CRITICAL!)

```bash
# On your server, generate secrets:
openssl rand -base64 32  # Use for JWT_AUTH_TOKEN_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_TOKEN_SECRET
openssl rand -base64 32  # Use for EXPRESS_SESSION_SECRET
openssl rand -base64 32  # Use for TOKEN_HASH_SECRET
```

Copy the output into your `.env.queue-source.local`:

```bash
JWT_AUTH_TOKEN_SECRET=paste-first-random-string-here
JWT_REFRESH_TOKEN_SECRET=paste-second-random-string-here
EXPRESS_SESSION_SECRET=paste-third-random-string-here
TOKEN_HASH_SECRET=paste-fourth-random-string-here
```

#### C) Queue Configuration

```bash
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379
```

#### D) App URL

```bash
APP_URL=http://your-server-ip:3000
# or for production: APP_URL=https://yourdomain.com
```

### 5️⃣ Deploy!

```bash
# Make script executable (first time only)
chmod +x deploy-queue-source.sh

# Start Flowise
./deploy-queue-source.sh start
```

---

## 📋 Complete Example Configurations

### Example 1: Quick Test Setup (SQLite)

**File: `.env.queue-source.local`**

```bash
# Basic
PORT=3000
WORKER_PORT=5566

# SQLite Database (simple, for testing)
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Keep commented

# Secrets (CHANGE THESE!)
JWT_AUTH_TOKEN_SECRET=xK7mN9pQ2wR5tY8zA3bC6dF4gH1jL0nM
JWT_REFRESH_TOKEN_SECRET=pQ2wR5tY8zA3bC6dF4gH1jL0nMxK7mN9
EXPRESS_SESSION_SECRET=wR5tY8zA3bC6dF4gH1jL0nMxK7mN9pQ2
TOKEN_HASH_SECRET=tY8zA3bC6dF4gH1jL0nMxK7mN9pQ2wR5

# Queue
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379

# Paths
SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs
BLOB_STORAGE_PATH=/root/.flowise/storage
STORAGE_TYPE=local

# App
APP_URL=http://localhost:3000
CORS_ORIGINS=*
IFRAME_ORIGINS=*
DEBUG=false
LOG_LEVEL=info
DISABLE_FLOWISE_TELEMETRY=true
```

**Deploy:**
```bash
./deploy-queue-source.sh start
```

---

### Example 2: Production with Docker PostgreSQL

**Step A: Create `docker-compose.override.yml`**

```bash
cd /path/to/Flowise/docker
nano docker-compose.override.yml
```

**Add this content:**

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
      POSTGRES_PASSWORD: YourStrongPostgresPassword123!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
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

**Step B: Configure `.env.queue-source.local`**

```bash
# Basic
PORT=3000
WORKER_PORT=5566

# PostgreSQL Database
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=postgres              # Docker service name
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=YourStrongPostgresPassword123!  # Must match docker-compose.override.yml

# Secrets (Generate with: openssl rand -base64 32)
JWT_AUTH_TOKEN_SECRET=your-generated-secret-1
JWT_REFRESH_TOKEN_SECRET=your-generated-secret-2
EXPRESS_SESSION_SECRET=your-generated-secret-3
TOKEN_HASH_SECRET=your-generated-secret-4

# Queue
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379
WORKER_CONCURRENCY=10

# Paths
SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs
BLOB_STORAGE_PATH=/root/.flowise/storage
STORAGE_TYPE=local

# App
APP_URL=http://your-server-ip:3000
CORS_ORIGINS=http://your-server-ip:3000
IFRAME_ORIGINS=http://your-server-ip:3000
DEBUG=false
LOG_LEVEL=info
DISABLE_FLOWISE_TELEMETRY=true

# Optional: Basic Auth
# FLOWISE_USERNAME=admin
# FLOWISE_PASSWORD=your-admin-password
```

**Step C: Deploy**

```bash
./deploy-queue-source.sh start
```

---

### Example 3: Production with External PostgreSQL

**For: AWS RDS, Google Cloud SQL, Azure Database, etc.**

**File: `.env.queue-source.local`**

```bash
# Basic
PORT=3000
WORKER_PORT=5566

# External PostgreSQL
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres
DATABASE_HOST=your-rds-instance.abc123.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=YourVeryStrongDatabasePassword!

# SSL for cloud databases
DATABASE_SSL=true
DATABASE_REJECT_UNAUTHORIZED=true

# Secrets
JWT_AUTH_TOKEN_SECRET=your-generated-secret-1
JWT_REFRESH_TOKEN_SECRET=your-generated-secret-2
EXPRESS_SESSION_SECRET=your-generated-secret-3
TOKEN_HASH_SECRET=your-generated-secret-4

# Queue
MODE=queue
QUEUE_NAME=flowise-queue
REDIS_URL=redis://redis:6379
WORKER_CONCURRENCY=20

# Paths
SECRETKEY_PATH=/root/.flowise
LOG_PATH=/root/.flowise/logs
STORAGE_TYPE=s3  # Use S3 for production with multiple workers
S3_STORAGE_BUCKET_NAME=my-flowise-storage
S3_STORAGE_REGION=us-east-1
S3_STORAGE_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_STORAGE_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# App
APP_URL=https://flowise.yourdomain.com
CORS_ORIGINS=https://flowise.yourdomain.com
IFRAME_ORIGINS=https://flowise.yourdomain.com
SECURE_COOKIES=true  # Enable with HTTPS
DEBUG=false
LOG_LEVEL=info
DISABLE_FLOWISE_TELEMETRY=true
NUMBER_OF_PROXIES=1  # If behind load balancer

# Email (optional - for user invitations)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_SECURE=false
# SENDER_EMAIL=noreply@yourdomain.com
```

---

## 🔧 Deployment Commands

### Start Flowise

```bash
./deploy-queue-source.sh start
```

### View Logs

```bash
./deploy-queue-source.sh logs
```

### Check Status

```bash
./deploy-queue-source.sh status
```

### Restart

```bash
./deploy-queue-source.sh restart
```

### Stop

```bash
./deploy-queue-source.sh stop
```

### Update After Code Changes

```bash
# Pull latest code
cd /path/to/Flowise
git pull

# Rebuild and deploy
cd docker
./deploy-queue-source.sh rebuild
```

### Scale Workers

```bash
# Scale to 3 workers
./deploy-queue-source.sh scale 3
```

---

## 🌐 Accessing Flowise

After deployment:

```bash
# Main application
http://your-server-ip:3000

# Queue dashboard (if ENABLE_BULLMQ_DASHBOARD=true)
http://your-server-ip:3000/admin/queues
```

---

## 🐛 Troubleshooting

### Issue: Containers won't start

```bash
# Check logs
./deploy-queue-source.sh logs

# Check container status
docker ps -a

# Check specific container
docker logs flowise-main
docker logs flowise-worker
docker logs flowise-redis
```

### Issue: Can't connect to database

```bash
# Test PostgreSQL connection from container
docker exec flowise-main nc -zv postgres 5432

# Check database logs
docker logs flowise-postgres

# Verify credentials match
docker exec flowise-main env | grep DATABASE
```

### Issue: Port already in use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Option 1: Stop the other service
# Option 2: Change PORT in .env.queue-source.local
```

### Issue: Redis connection failed

```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connection
docker exec flowise-main nc -zv redis 6379

# Check Redis logs
docker logs flowise-redis
```

### Issue: Workers not processing jobs

```bash
# Check worker logs
docker logs flowise-worker -f

# Check BullMQ dashboard
http://your-server-ip:3000/admin/queues

# Verify Redis connection
docker exec flowise-worker env | grep REDIS
```

---

## 🔒 Security Checklist

Before going live:

- [ ] Changed all JWT secrets from defaults
- [ ] Using PostgreSQL (not SQLite)
- [ ] Strong database password set
- [ ] CORS_ORIGINS restricted to your domain
- [ ] SECURE_COOKIES=true (if using HTTPS)
- [ ] DEBUG=false
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] SSL/HTTPS configured (use Nginx/Caddy)
- [ ] Regular backups configured
- [ ] Monitoring set up

---

## 📊 Server Requirements

### Minimum (Development/Testing)

- **CPU:** 2 cores
- **RAM:** 4 GB
- **Disk:** 20 GB
- **OS:** Ubuntu 20.04+ / Debian 11+ / Amazon Linux 2

### Recommended (Production - Small)

- **CPU:** 4 cores
- **RAM:** 8 GB
- **Disk:** 50 GB SSD
- **OS:** Ubuntu 22.04 LTS
- **Database:** External PostgreSQL

### Recommended (Production - Medium)

- **CPU:** 8 cores
- **RAM:** 16 GB
- **Disk:** 100 GB SSD
- **Workers:** 3-5 instances
- **Database:** Managed PostgreSQL (RDS, Cloud SQL)
- **Storage:** S3/GCS

---

## 🔄 Update Workflow

```bash
# 1. Pull latest code
cd /path/to/Flowise
git pull

# 2. Check for .env changes
git diff HEAD@{1} docker/.env.queue-source

# 3. Update your .env if needed
nano docker/.env.queue-source.local

# 4. Rebuild and deploy
cd docker
./deploy-queue-source.sh rebuild

# 5. Verify
./deploy-queue-source.sh status
./deploy-queue-source.sh logs
```

---

## 🆘 Getting Help

1. **View logs:** `./deploy-queue-source.sh logs`
2. **Check status:** `./deploy-queue-source.sh status`
3. **Read guides:**
   - [QUEUE-SOURCE-SETUP.md](./QUEUE-SOURCE-SETUP.md)
   - [DATABASE-CONFIG-GUIDE.md](./DATABASE-CONFIG-GUIDE.md)
4. **GitHub Issues:** https://github.com/FlowiseAI/Flowise/issues
5. **Documentation:** https://docs.flowiseai.com

---

## 💡 Pro Tips

1. **Always backup before updates:**
   ```bash
   docker exec flowise-postgres pg_dump -U flowise flowise > backup-$(date +%Y%m%d).sql
   ```

2. **Monitor logs regularly:**
   ```bash
   ./deploy-queue-source.sh logs | grep -i error
   ```

3. **Use external database for production** (RDS, Cloud SQL)

4. **Set up log rotation** to prevent disk space issues

5. **Use Docker healthchecks** (already configured in compose file)

6. **Scale workers based on load:**
   ```bash
   ./deploy-queue-source.sh scale 5  # More workers = more capacity
   ```

7. **Monitor BullMQ dashboard** for job queue health

8. **Regular security updates:**
   ```bash
   docker-compose pull
   ./deploy-queue-source.sh rebuild
   ```
