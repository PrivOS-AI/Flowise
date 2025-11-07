# ⚡ Flowise Queue Mode - Quick Start (5 Minutes)

## 📋 Prerequisites

- Docker & Docker Compose installed
- Source code cloned
- Terminal access

---

## 🚀 Deploy in 5 Steps

### 1️⃣ Navigate to docker folder
```bash
cd docker
```

### 2️⃣ Create your environment file
```bash
cp .env.queue-source .env.queue-source.local
```

### 3️⃣ Edit critical settings (REQUIRED!)
```bash
nano .env.queue-source.local
```

**Minimum required changes:**

```bash
# Change these JWT secrets (CRITICAL!)
JWT_AUTH_TOKEN_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
EXPRESS_SESSION_SECRET=$(openssl rand -base64 32)

# For production: Use PostgreSQL
DATABASE_TYPE=postgres
DATABASE_HOST=your-postgres-host
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=your-secure-password
```

### 4️⃣ Deploy!
```bash
./deploy-queue-source.sh start
```

### 5️⃣ Access Flowise
```
🌐 Main App: http://localhost:3000
📊 Queue Dashboard: http://localhost:3000/admin/queues
```

---

## 🔄 Common Commands

```bash
# View logs
./deploy-queue-source.sh logs

# Check status
./deploy-queue-source.sh status

# Restart (quick)
./deploy-queue-source.sh restart

# Rebuild (after code changes)
./deploy-queue-source.sh rebuild

# Git pull + deploy
./deploy-queue-source.sh deploy

# Stop everything
./deploy-queue-source.sh stop
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | Change `PORT=3001` in `.env` file |
| Can't connect to DB | Check DATABASE_HOST and credentials |
| Workers not processing | Check Redis connection in logs |
| Build fails | Run `./deploy-queue-source.sh clean` then `start` |

---

## 📚 Full Documentation

See [QUEUE-SOURCE-SETUP.md](./QUEUE-SOURCE-SETUP.md) for detailed guide.

---

## ✅ Production Checklist

Before going to production:

- [ ] Use PostgreSQL (not SQLite)
- [ ] Generate unique JWT secrets
- [ ] Set APP_URL to your domain
- [ ] Configure CORS_ORIGINS
- [ ] Enable HTTPS (use Nginx/Caddy)
- [ ] Set SECURE_COOKIES=true
- [ ] Configure SMTP for emails
- [ ] Set DEBUG=false
- [ ] Backup strategy in place

---

**That's it! You're running Flowise in queue mode with your custom code!** 🎉
