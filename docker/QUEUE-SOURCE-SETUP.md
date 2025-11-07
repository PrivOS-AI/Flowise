# Flowise Queue Mode - Source Build Deployment Guide

## 🚀 Quick Start

Deploy Flowise in queue mode, building from **your modified source code**:

```bash
cd docker

# 1. Configure environment (IMPORTANT - do this first!)
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local

# 2. Deploy
./deploy-queue-source.sh start

# 3. Access
# Main API: http://localhost:3000
# Queue Dashboard: http://localhost:3000/admin/queues
```

---

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `docker-compose-queue-source.yml` | Docker compose config that builds from source |
| `.env.queue-source` | Sample environment variables (template) |
| `deploy-queue-source.sh` | Deployment automation script |

---

## 🔧 Configuration Steps

### 1. **Edit Environment File**

```bash
cd docker
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local  # or use your favorite editor
```

### 2. **Critical Settings to Change**

#### **Database (REQUIRED for production)**

```bash
# Change from SQLite to PostgreSQL
DATABASE_TYPE=postgres
DATABASE_HOST=your-postgres-host  # e.g., localhost or postgres
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=strong-password-here
```

#### **Security Secrets (CRITICAL)**

Generate strong random secrets:
```bash
# Generate JWT secrets
openssl rand -base64 32
```

Then update:
```bash
JWT_AUTH_TOKEN_SECRET=<paste-random-string-here>
JWT_REFRESH_TOKEN_SECRET=<paste-different-random-string>
EXPRESS_SESSION_SECRET=<another-random-string>
TOKEN_HASH_SECRET=<yet-another-random-string>
```

#### **Application URL**

```bash
# For production
APP_URL=https://yourdomain.com

# For local testing
APP_URL=http://localhost:3000
```

#### **CORS (Security)**

```bash
# Restrict to your domain in production
CORS_ORIGINS=https://yourdomain.com
IFRAME_ORIGINS=https://yourdomain.com

# For development (less secure)
CORS_ORIGINS=*
IFRAME_ORIGINS=*
```

---

## 🎯 Deployment Commands

### Using the Deploy Script (Recommended)

```bash
# Start everything
./deploy-queue-source.sh start

# View logs
./deploy-queue-source.sh logs

# Check status
./deploy-queue-source.sh status

# Restart (quick, no rebuild)
./deploy-queue-source.sh restart

# Rebuild from source (after code changes)
./deploy-queue-source.sh rebuild

# Git pull + rebuild + deploy
./deploy-queue-source.sh deploy

# Scale workers (3 instances)
./deploy-queue-source.sh scale 3

# Stop everything
./deploy-queue-source.sh stop

# Clean everything (removes containers, volumes, images)
./deploy-queue-source.sh clean
```

### Manual Docker Compose Commands

```bash
# Start with build
docker-compose -f docker-compose-queue-source.yml --env-file .env.queue-source.local up --build -d

# Stop
docker-compose -f docker-compose-queue-source.yml down

# Force rebuild (after code changes)
docker-compose -f docker-compose-queue-source.yml build --no-cache
docker-compose -f docker-compose-queue-source.yml up -d

# View logs
docker-compose -f docker-compose-queue-source.yml logs -f

# Scale workers
docker-compose -f docker-compose-queue-source.yml up -d --scale flowise-worker=3
```

---

## 🔄 Development Workflow

When you modify source code:

```bash
# Option 1: Using the script (easiest)
./deploy-queue-source.sh rebuild

# Option 2: Git pull and deploy (recommended for updates)
./deploy-queue-source.sh deploy

# Option 3: Manual
docker-compose -f docker-compose-queue-source.yml down
docker-compose -f docker-compose-queue-source.yml build --no-cache
docker-compose -f docker-compose-queue-source.yml --env-file .env.queue-source.local up -d
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Client Requests                    │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
         ┌───────────────────┐
         │  Flowise Main     │  Port 3000
         │  (API Server)     │  Handles requests
         └─────────┬─────────┘  Enqueues jobs
                   │
                   ▼
         ┌───────────────────┐
         │      Redis        │  Port 6379
         │  (Message Queue)  │  Job queue
         └─────────┬─────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Worker 1 │ │ Worker 2 │ │ Worker N │
│(Executor)│ │(Executor)│ │(Executor)│
└─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │
      └────────────┼────────────┘
                   ▼
         ┌───────────────────┐
         │    PostgreSQL     │  Port 5432
         │    (Database)     │  Shared data
         └───────────────────┘
```

**Components:**

- **Main Server** - Handles API requests, enqueues jobs to Redis
- **Workers** - Process jobs from queue (can scale horizontally)
- **Redis** - Message queue (BullMQ)
- **PostgreSQL** - Shared database

---

## 📊 Monitoring

### BullMQ Dashboard

Access the queue dashboard to monitor jobs:

```
http://localhost:3000/admin/queues
```

Enable in `.env`:
```bash
ENABLE_BULLMQ_DASHBOARD=true
```

### View Logs

```bash
# All containers
./deploy-queue-source.sh logs

# Specific container
docker logs flowise-main -f
docker logs flowise-worker -f
docker logs flowise-redis -f
```

### Check Container Status

```bash
./deploy-queue-source.sh status

# Or manually
docker-compose -f docker-compose-queue-source.yml ps
```

---

## 📈 Scaling

### Scale Workers Horizontally

```bash
# Run 5 workers
./deploy-queue-source.sh scale 5

# Or manually
docker-compose -f docker-compose-queue-source.yml up -d --scale flowise-worker=5
```

### When to Scale

- **1 worker**: Development, low traffic (<100 requests/min)
- **2-3 workers**: Small production (100-500 requests/min)
- **5+ workers**: Medium production (500-2000 requests/min)
- **10+ workers**: High traffic (>2000 requests/min)

### Adjust Worker Concurrency

In `.env.queue-source.local`:
```bash
# Each worker can handle N concurrent jobs
WORKER_CONCURRENCY=10  # Increase for more parallel processing
```

---

## 🗄️ Database Setup

### Using External PostgreSQL

```bash
# In .env.queue-source.local
DATABASE_TYPE=postgres
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=your-password
```

### Using Docker PostgreSQL

Create `docker-compose.override.yml`:

```yaml
version: '3.1'

services:
  postgres:
    image: postgres:16-alpine
    container_name: flowise-postgres
    environment:
      POSTGRES_DB: flowise
      POSTGRES_USER: flowise
      POSTGRES_PASSWORD: your-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - flowise-net

volumes:
  postgres_data:
    driver: local
```

Then update `.env`:
```bash
DATABASE_TYPE=postgres
DATABASE_HOST=postgres  # service name
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=your-password
```

---

## 🔒 Security Checklist

For production deployment:

- [ ] ✅ Use PostgreSQL, not SQLite
- [ ] ✅ Generate strong random JWT secrets
- [ ] ✅ Change all default passwords
- [ ] ✅ Set `APP_URL` to your domain
- [ ] ✅ Restrict `CORS_ORIGINS` to your domain
- [ ] ✅ Enable `SECURE_COOKIES=true` (with HTTPS)
- [ ] ✅ Set `DEBUG=false` and `LOG_LEVEL=info`
- [ ] ✅ Configure Redis password
- [ ] ✅ Use HTTPS (configure reverse proxy)
- [ ] ✅ Set `DISABLE_FLOWISE_TELEMETRY=true`
- [ ] ✅ Configure SMTP for email notifications
- [ ] ✅ Review and restrict `TRUST_PROXY` setting

---

## 🐛 Troubleshooting

### Containers Won't Start

```bash
# Check logs
./deploy-queue-source.sh logs

# Check status
docker-compose -f docker-compose-queue-source.yml ps
```

### Database Connection Failed

```bash
# Test database connection
docker exec flowise-main curl http://localhost:3000/api/v1/ping

# Check database host is correct
docker exec flowise-main env | grep DATABASE
```

### Workers Not Processing Jobs

```bash
# Check Redis connection
docker exec flowise-main redis-cli -h redis ping

# Check worker logs
docker logs flowise-worker -f

# Check BullMQ dashboard
# http://localhost:3000/admin/queues
```

### Build Fails

```bash
# Clean everything and rebuild
./deploy-queue-source.sh clean
./deploy-queue-source.sh start

# Or manually
docker system prune -a
docker-compose -f docker-compose-queue-source.yml build --no-cache
```

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Change port in .env
PORT=3001
```

---

## 📝 Common Tasks

### Backup Database

```bash
# If using Docker PostgreSQL
docker exec flowise-postgres pg_dump -U flowise flowise > backup.sql

# Restore
docker exec -i flowise-postgres psql -U flowise flowise < backup.sql
```

### Update to Latest Code

```bash
# Using script
./deploy-queue-source.sh deploy

# Manual
cd ..
git pull
cd docker
docker-compose -f docker-compose-queue-source.yml down
docker-compose -f docker-compose-queue-source.yml build --no-cache
docker-compose -f docker-compose-queue-source.yml up -d
```

### Change Configuration

```bash
# Edit .env file
nano .env.queue-source.local

# Restart to apply changes
./deploy-queue-source.sh restart
```

---

## 🌐 Reverse Proxy Setup

### Nginx Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📚 Additional Resources

- [Flowise Documentation](https://docs.flowiseai.com)
- [Queue Mode Guide](https://docs.flowiseai.com/configuration/running-flowise-using-queue)
- [Environment Variables](https://docs.flowiseai.com/configuration/environment-variables)
- [Deployment Guide](https://docs.flowiseai.com/configuration/deployment)

---

## 💡 Tips

1. **Always use PostgreSQL in production** - SQLite doesn't handle concurrent writes well
2. **Monitor the BullMQ dashboard** - Watch job queues and worker health
3. **Scale workers based on load** - Add more workers during high traffic
4. **Use S3/GCS for storage** - When running multiple workers
5. **Set up proper logging** - Use LOG_LEVEL=info in production
6. **Enable metrics** - Use Prometheus or OpenTelemetry for monitoring
7. **Regular backups** - Backup database and `.flowise` folder
8. **Test locally first** - Use Docker to test changes before production

---

## 🆘 Support

If you encounter issues:

1. Check logs: `./deploy-queue-source.sh logs`
2. Verify configuration: `docker-compose -f docker-compose-queue-source.yml config`
3. Check GitHub issues: [Flowise Issues](https://github.com/FlowiseAI/Flowise/issues)
4. Review documentation: [docs.flowiseai.com](https://docs.flowiseai.com)
