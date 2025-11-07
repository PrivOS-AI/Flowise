# 🔧 Troubleshooting Guide

## Common Issues & Solutions

### 1. ❌ Permission Denied - Docker Socket

**Error:**
```
permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
```

**Solution:**

```bash
# Fix 1: Add user to docker group (RECOMMENDED)
sudo usermod -aG docker $USER

# Apply changes (choose one):
newgrp docker              # Option A: No logout needed
# OR logout and login again # Option B: Full refresh

# Verify
docker ps

# If still not working, restart docker
sudo systemctl restart docker

# Try again
./deploy-queue-source.sh start
```

---

### 2. ⚠️ Version Warning (Ignore or Fix)

**Warning:**
```
WARN: the attribute `version` is obsolete
```

**This is harmless!** Docker Compose 2.x doesn't need `version:` anymore.

**To remove warning (optional):**
- The `version: '3.1'` line has been removed from the docker-compose file
- You can pull the latest version with `git pull`

---

### 3. ❌ Port Already in Use

**Error:**
```
Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use
```

**Solution:**

```bash
# Check what's using port 3000
sudo lsof -i :3000
# or
sudo netstat -tulpn | grep 3000

# Option A: Stop the other service
sudo systemctl stop <service-name>

# Option B: Change port in .env
nano .env.queue-source.local
# Change: PORT=3001

# Option C: Kill the process
sudo kill -9 <PID>
```

---

### 4. ❌ Cannot Connect to Database

**Error:**
```
Error: connect ECONNREFUSED
Unable to connect to the database
```

**Solution:**

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database credentials match
docker exec flowise-main env | grep DATABASE

# Test connection from container
docker exec flowise-main nc -zv postgres 5432

# Check PostgreSQL logs
docker logs flowise-postgres

# Verify credentials in .env.queue-source.local match docker-compose.override.yml
```

**Common mistakes:**
- DATABASE_HOST wrong (should be `postgres` for docker-compose)
- Password mismatch between .env and docker-compose.override.yml
- PostgreSQL container not running

---

### 5. ❌ Redis Connection Failed

**Error:**
```
Error: Redis connection failed
```

**Solution:**

```bash
# Check Redis is running
docker ps | grep redis

# Check Redis connection
docker exec flowise-main nc -zv redis 6379

# Check Redis logs
docker logs flowise-redis

# Restart Redis
docker restart flowise-redis

# Check REDIS_URL in .env
# Should be: REDIS_URL=redis://redis:6379
```

---

### 6. ❌ Workers Not Processing Jobs

**Symptom:** Jobs stuck in queue, workers idle

**Solution:**

```bash
# Check worker logs
docker logs flowise-worker -f

# Check if worker is running
docker ps | grep worker

# Check worker environment
docker exec flowise-worker env | grep -E "MODE|QUEUE|REDIS"

# Should see:
# MODE=queue
# QUEUE_NAME=flowise-queue
# REDIS_URL=redis://redis:6379

# Restart worker
docker restart flowise-worker

# Check BullMQ dashboard
# http://your-server-ip:3000/admin/queues
```

---

### 7. ❌ Build Failed

**Error:**
```
ERROR: failed to solve: error from sender: open /path: permission denied
```

**Solution:**

```bash
# Clean docker cache
docker system prune -a

# Try rebuild
./deploy-queue-source.sh clean
./deploy-queue-source.sh start

# If still failing, check disk space
df -h

# Check docker service
sudo systemctl status docker
```

---

### 8. ❌ Container Keeps Restarting

**Symptom:** Container status shows "Restarting"

**Solution:**

```bash
# Check container logs
docker logs flowise-main

# Check all containers
docker-compose -f docker-compose-queue-source.yml ps

# Common causes:
# - Missing environment variables
# - Database connection failed
# - Invalid configuration

# Check environment
docker exec flowise-main env

# Restart in foreground to see errors
docker-compose -f docker-compose-queue-source.yml up
```

---

### 9. ❌ Out of Memory / Disk Space

**Error:**
```
Cannot allocate memory
No space left on device
```

**Solution:**

```bash
# Check disk space
df -h

# Check memory
free -h

# Clean docker
docker system prune -a
docker volume prune

# Remove old images
docker image prune -a

# Check logs size
du -sh /var/lib/docker
```

---

### 10. ❌ Cannot Access from Browser

**Symptom:** Can't reach http://server-ip:3000

**Solution:**

```bash
# Check if container is running
docker ps | grep flowise-main

# Check if port is open
sudo netstat -tulpn | grep 3000

# Check firewall
sudo ufw status
sudo ufw allow 3000/tcp

# For cloud servers (AWS, GCP, Azure):
# Check Security Group / Firewall rules
# Must allow inbound TCP port 3000

# Test locally on server
curl http://localhost:3000/api/v1/ping

# Check container logs
docker logs flowise-main
```

---

### 11. ❌ JWT Token Errors

**Error:**
```
Invalid or Missing token
Token Expired
```

**Solution:**

```bash
# Check JWT secrets are set
docker exec flowise-main env | grep JWT

# Make sure these are set in .env:
# JWT_AUTH_TOKEN_SECRET=...
# JWT_REFRESH_TOKEN_SECRET=...

# If changed secrets, restart
./deploy-queue-source.sh restart

# Clear browser cookies/cache
```

---

### 12. ❌ Database Migration Failed

**Error:**
```
Migration failed
Could not run migrations
```

**Solution:**

```bash
# Check database is accessible
docker exec flowise-main nc -zv postgres 5432

# Check migration logs
docker logs flowise-main | grep -i migration

# Manual migration (if needed)
docker exec flowise-main pnpm typeorm migration:run

# Nuclear option: Reset database (LOSES DATA!)
docker-compose -f docker-compose-queue-source.yml down -v
./deploy-queue-source.sh start
```

---

## 🔍 Diagnostic Commands

### Check Everything

```bash
# System status
docker --version
docker-compose --version
df -h                    # Disk space
free -h                  # Memory
uptime                   # System load

# Container status
docker ps -a
docker-compose -f docker-compose-queue-source.yml ps

# Logs
./deploy-queue-source.sh logs

# Specific container logs
docker logs flowise-main -f
docker logs flowise-worker -f
docker logs flowise-redis -f
docker logs flowise-postgres -f
```

### Check Configuration

```bash
# View parsed docker-compose
docker-compose -f docker-compose-queue-source.yml config

# Check environment variables
docker exec flowise-main env | sort

# Check network
docker network ls
docker network inspect flowise-net
```

### Test Connections

```bash
# Test Redis
docker exec flowise-main redis-cli -h redis ping

# Test PostgreSQL
docker exec flowise-main pg_isready -h postgres -p 5432

# Test HTTP
curl http://localhost:3000/api/v1/ping
```

---

## 🆘 Emergency Recovery

### Complete Reset (LOSES ALL DATA!)

```bash
# Stop everything
docker-compose -f docker-compose-queue-source.yml down -v

# Remove images
docker-compose -f docker-compose-queue-source.yml down --rmi all

# Clean system
docker system prune -a --volumes

# Fresh start
./deploy-queue-source.sh start
```

### Backup Before Reset

```bash
# Backup PostgreSQL
docker exec flowise-postgres pg_dump -U flowise flowise > backup.sql

# Backup SQLite
docker cp flowise-main:/root/.flowise/database.sqlite ./backup-database.sqlite

# Backup uploads
docker cp flowise-main:/root/.flowise ./backup-flowise
```

---

## 📋 Health Check Commands

```bash
# Quick health check
curl http://localhost:3000/api/v1/ping

# Container health
docker inspect flowise-main | grep -A 10 Health

# Service logs (last 50 lines)
docker logs flowise-main --tail 50

# Follow logs in real-time
docker logs flowise-main -f
```

---

## 🔐 Security Issues

### Exposed Secrets in Logs

```bash
# Check if secrets in logs
docker logs flowise-main 2>&1 | grep -i "password\|secret\|token"

# If found, rotate ALL secrets immediately
nano .env.queue-source.local
# Change all passwords, JWT secrets, etc.

./deploy-queue-source.sh restart
```

### Port Security

```bash
# Check exposed ports
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Restrict PostgreSQL port (should not be public)
# In docker-compose.override.yml, change:
# ports:
#   - "5432:5432"  # ❌ Exposed to world
# To:
# ports:
#   - "127.0.0.1:5432:5432"  # ✅ Localhost only
```

---

## 💡 Performance Issues

### Slow Response Times

```bash
# Check system resources
docker stats

# Check database queries
docker logs flowise-main | grep -i "slow query"

# Increase worker concurrency
# In .env.queue-source.local:
WORKER_CONCURRENCY=20  # Increase from 10

# Scale workers
./deploy-queue-source.sh scale 5
```

### High Memory Usage

```bash
# Check memory usage
docker stats --no-stream

# Set memory limits in docker-compose-queue-source.yml:
# Add under each service:
#   deploy:
#     resources:
#       limits:
#         cpus: '2'
#         memory: 2G
```

---

## 📞 Getting More Help

1. **Check logs first:**
   ```bash
   ./deploy-queue-source.sh logs
   ```

2. **Search GitHub issues:**
   https://github.com/FlowiseAI/Flowise/issues

3. **Check documentation:**
   https://docs.flowiseai.com

4. **Community Discord:**
   https://discord.gg/jbaHfsRVBW

---

## 🎯 Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Permission denied | `sudo usermod -aG docker $USER && newgrp docker` |
| Port in use | Change `PORT=` in `.env` |
| Can't connect to DB | Check DATABASE_HOST, credentials match |
| Workers idle | Check Redis connection, restart workers |
| Can't access browser | Check firewall: `sudo ufw allow 3000/tcp` |
| Build fails | `docker system prune -a` then rebuild |
| Out of disk | `docker system prune -a --volumes` |

---

**Remember:** Most issues can be diagnosed with:
```bash
./deploy-queue-source.sh logs
```
