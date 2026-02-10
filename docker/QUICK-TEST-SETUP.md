# ⚡ Quick Test Setup (SQLite Default)

## 🎯 Zero-Config Quick Start

The template (`.env.queue-source`) now uses **SQLite by default** for instant testing!

```bash
cd docker

# If .env.queue-source.local doesn't exist, script creates it from template
# Template uses SQLite by default - no database setup needed!
./deploy-queue-source.sh start

# That's it! Flowise runs with SQLite
# Access: http://localhost:3000
```

---

## 🔍 How It Works

### Default Behavior (SQLite)

When you first run the script without `.env.queue-source.local`:

```bash
./deploy-queue-source.sh start
```

**What happens:**
1. Script checks for `.env.queue-source.local` → Not found
2. Script copies `.env.queue-source` → Creates `.env.queue-source.local`
3. Uses **SQLite by default** (no DATABASE_TYPE set)
4. Starts immediately ✅

**Database config in template:**
```bash
# SQLite (default)
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Commented = SQLite
```

---

## 📊 Configuration Options

### Option 1: Quick Test (SQLite - Default)

**File: `.env.queue-source.local`**

```bash
# Just use defaults - SQLite is already configured
DATABASE_PATH=/root/.flowise
# DATABASE_TYPE=  ← Keep commented for SQLite
```

**Deploy:**
```bash
./deploy-queue-source.sh start
```

**Result:** Works immediately with SQLite file database

---

### Option 2: Production (PostgreSQL)

**File: `.env.queue-source.local`**

```bash
# Uncomment and configure PostgreSQL
DATABASE_PATH=/root/.flowise
DATABASE_TYPE=postgres          # ← Uncomment this
DATABASE_HOST=postgres          # ← Uncomment and set
DATABASE_PORT=5432
DATABASE_NAME=flowise
DATABASE_USER=flowise
DATABASE_PASSWORD=YourPassword123!
```

**Deploy:**
```bash
./deploy-queue-source.sh start
```

**Result:** Connects to PostgreSQL

---

## 🔄 Migration Path

### From Quick Test → Production

```bash
# Step 1: Test with SQLite (default)
./deploy-queue-source.sh start
# Test your workflows, everything works!

# Step 2: Backup SQLite data (optional)
docker cp flowise-main:/root/.flowise/database.sqlite ./backup.sqlite

# Step 3: Switch to PostgreSQL
nano .env.queue-source.local

# Uncomment these lines:
# DATABASE_TYPE=postgres
# DATABASE_HOST=postgres
# DATABASE_PORT=5432
# DATABASE_NAME=flowise
# DATABASE_USER=flowise
# DATABASE_PASSWORD=YourPassword123!

# Step 4: Deploy with PostgreSQL
./deploy-queue-source.sh rebuild
```

---

## 🎯 Use Cases

### Use Case 1: Quick Demo/Test

**Scenario:** Want to test Flowise quickly

```bash
cd docker
./deploy-queue-source.sh start  # Uses SQLite default
# Done! Test immediately
```

**No setup needed:**
- ✅ No PostgreSQL required
- ✅ No database credentials
- ✅ Works immediately

---

### Use Case 2: Development

**Scenario:** Developing custom features

```bash
# Use SQLite for speed
cd docker
nano .env.queue-source.local
# Keep DATABASE_TYPE commented

./deploy-queue-source.sh start
# Develop and test with SQLite
```

**Benefits:**
- Fast restarts
- Easy to reset (delete database.sqlite)
- No external dependencies

---

### Use Case 3: Production

**Scenario:** Deploying to production

```bash
# Switch to PostgreSQL
cd docker
nano .env.queue-source.local
# Uncomment DATABASE_TYPE=postgres
# Set all PostgreSQL credentials

./deploy-queue-source.sh start
```

**Benefits:**
- Better performance
- Concurrent access
- Production-grade reliability

---

## 📋 Template vs Local File Behavior

### Scenario A: First Run (No .local file)

```bash
├── .env.queue-source          ✅ Exists (template)
│   DATABASE_TYPE commented    ← SQLite default
├── .env.queue-source.local    ❌ Doesn't exist
```

**When you run:**
```bash
./deploy-queue-source.sh start
```

**Script does:**
1. Creates `.env.queue-source.local` from template
2. Template has DATABASE_TYPE commented
3. **Uses SQLite by default** ✅

---

### Scenario B: Configured (Has .local file)

```bash
├── .env.queue-source          ✅ Template (ignored)
├── .env.queue-source.local    ✅ Your config (used)
│   DATABASE_TYPE=postgres     ← You set this
```

**When you run:**
```bash
./deploy-queue-source.sh start
```

**Script does:**
1. Uses `.env.queue-source.local`
2. Reads DATABASE_TYPE=postgres
3. **Connects to PostgreSQL** ✅

---

## ✅ Benefits of This Approach

### 1. **Zero Configuration**
```bash
# Works immediately without any setup
./deploy-queue-source.sh start
```

### 2. **Safe Defaults**
```bash
# Template uses SQLite (simple, no external dependencies)
# Won't fail due to missing PostgreSQL
```

### 3. **Easy Upgrade Path**
```bash
# Start with SQLite, migrate to PostgreSQL later
# Just uncomment DATABASE_TYPE in .local file
```

### 4. **Team Friendly**
```bash
# New developer clones repo
git clone <repo>
cd docker
./deploy-queue-source.sh start
# Works immediately! No database setup needed
```

---

## 🔍 Verification

### Check Which Database Is Used

```bash
# Method 1: Check env file
cat docker/.env.queue-source.local | grep DATABASE_TYPE

# If commented or empty → SQLite
# If set to postgres → PostgreSQL

# Method 2: Check container
docker exec flowise-main env | grep DATABASE_TYPE

# If empty → SQLite
# If shows postgres → PostgreSQL

# Method 3: Check logs
docker logs flowise-main 2>&1 | grep -i "database\|data source"
```

### Check SQLite Database File

```bash
# If using SQLite, database file exists at:
docker exec flowise-main ls -lh /root/.flowise/database.sqlite

# Should output: database.sqlite file with size
```

---

## ⚠️ Important Notes

### SQLite Limitations

**Only for:**
- ✅ Development
- ✅ Testing
- ✅ Quick demos
- ✅ Single user

**NOT for:**
- ❌ Production
- ❌ Multiple workers (queue mode)
- ❌ High concurrency
- ❌ Multiple simultaneous users

**Why?** SQLite locks on concurrent writes

---

### When to Switch to PostgreSQL

Switch when you have:
- Multiple workers (`WORKER_CONCURRENCY > 1`)
- High traffic (>10 concurrent users)
- Production deployment
- Need for backups/replication
- Scaling requirements

---

## 🚀 Quick Commands

```bash
# Start with SQLite (default)
./deploy-queue-source.sh start

# Switch to PostgreSQL later
nano .env.queue-source.local
# Uncomment DATABASE_TYPE=postgres
./deploy-queue-source.sh restart

# Check which database is used
docker exec flowise-main env | grep DATABASE_TYPE
```

---

## 💡 Pro Tips

1. **Keep template simple** - SQLite default makes testing easy
2. **Document your choice** - Comment why SQLite or PostgreSQL
3. **Test with SQLite first** - Verify everything works before PostgreSQL
4. **Backup before switching** - Save SQLite file before migrating
5. **Use PostgreSQL for production** - Always for real deployments

---

## 📝 Summary

**Default Behavior:**
```
No .env.queue-source.local
    ↓
Script creates from template
    ↓
Template has DATABASE_TYPE commented
    ↓
Uses SQLite by default ✅
    ↓
Works immediately!
```

**Your Observation Was Correct!**

Since the script falls back to `.env.queue-source` (template), it **should** use SQLite by default for easy testing. That's exactly what it does now! 🎉
