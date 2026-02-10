# 📝 Environment File Priority & Usage

## 🎯 How It Works Now (After Fix)

The `deploy-queue-source.sh` script now intelligently chooses which `.env` file to use:

```bash
# Priority order:
1. .env.queue-source.local  ← Your actual config (PREFERRED)
2. .env.queue-source        ← Template file (FALLBACK)
```

---

## 🔍 File Purposes

| File | Purpose | Git? | Contains Secrets? |
|------|---------|------|-------------------|
| `.env.queue-source` | Template with examples | ✅ Yes | ❌ No (placeholders) |
| `.env.queue-source.local` | Your actual config | ❌ No (ignored) | ✅ Yes (real secrets) |

---

## 🚀 What Changed

### Before (Bug)

```bash
# Script always used .env.queue-source
ENV_FILE=".env.queue-source"  # ❌ Wrong - this is the template!
```

**Problem:** Used template file with placeholder secrets

### After (Fixed)

```bash
# Script prefers .env.queue-source.local
if [ -f "$PROJECT_DIR/.env.queue-source.local" ]; then
    ENV_FILE=".env.queue-source.local"  # ✅ Your actual config
else
    ENV_FILE=".env.queue-source"        # Fallback to template
fi
```

**Benefit:** Uses your actual secrets automatically

---

## ✅ Best Practice Workflow

### 1. First Time Setup

```bash
cd docker

# Script will auto-create .env.queue-source.local from template
./deploy-queue-source.sh start

# Output:
# ℹ Creating .env.queue-source.local from template...
# ✓ Created .env.queue-source.local
# ⚠ Please edit .env.queue-source.local with your secrets before deploying!

# Edit with your secrets
nano .env.queue-source.local

# Deploy with your actual config
./deploy-queue-source.sh start
```

### 2. Normal Usage

```bash
# Just run the script - it automatically uses .env.queue-source.local
./deploy-queue-source.sh start

# Output:
# ✓ Using environment file: .env.queue-source.local
```

---

## 📊 Decision Tree

```
Script starts
    │
    ▼
Does .env.queue-source.local exist?
    │
    ├─ YES → Use .env.queue-source.local ✅
    │         (Your actual secrets)
    │
    └─ NO → Use .env.queue-source ⚠️
              (Template with placeholders)
              Auto-create .local copy
              Exit with warning
```

---

## 🔧 Examples

### Example 1: Fresh Clone (No .local file)

```bash
cd docker
./deploy-queue-source.sh start
```

**Output:**
```
ℹ Checking prerequisites...
✗ Environment file not found: .env.queue-source.local
ℹ Creating .env.queue-source.local from template...
✓ Created .env.queue-source.local
⚠ Please edit .env.queue-source.local with your secrets before deploying!
ℹ At minimum, change:
ℹ   - JWT_AUTH_TOKEN_SECRET
ℹ   - JWT_REFRESH_TOKEN_SECRET
ℹ   - DATABASE credentials (if using PostgreSQL)
```

**Action:** Edit `.env.queue-source.local` then run again

---

### Example 2: Configured Server (Has .local file)

```bash
cd docker
./deploy-queue-source.sh start
```

**Output:**
```
ℹ Checking prerequisites...
✓ Using environment file: .env.queue-source.local
✓ Prerequisites check passed
ℹ Starting Flowise in Queue Mode (building from source)...
```

**Result:** Deploys with your secrets ✅

---

## 🔄 Migration Guide

If you were using `.env.queue-source` directly (old way):

```bash
cd docker

# Rename your configured file
mv .env.queue-source .env.queue-source.local

# Now pull the latest template
git pull

# Your .env.queue-source.local is preserved (it's gitignored)
# Template .env.queue-source is updated from git
```

---

## ⚠️ Common Mistakes

### Mistake 1: Editing Template Instead of .local

```bash
# ❌ WRONG - editing template (won't be used if .local exists)
nano .env.queue-source

# ✅ CORRECT - edit your local config
nano .env.queue-source.local
```

### Mistake 2: Committing .local to Git

```bash
# Check what you're about to commit
git status

# If you see .env.queue-source.local listed:
# ❌ DO NOT commit it (contains secrets!)

# Remove from staging
git reset HEAD .env.queue-source.local
```

### Mistake 3: Deploying Without Secrets

```bash
# If you see this warning after deploy:
# "Using .env.queue-source (template)"

# It means .local file is missing or not found
# Fix:
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local  # Add your secrets
./deploy-queue-source.sh restart
```

---

## 🔍 Verify Which File Is Used

```bash
# Check which file will be used
cd docker

if [ -f ".env.queue-source.local" ]; then
    echo "✅ Will use: .env.queue-source.local"
else
    echo "⚠️  Will use: .env.queue-source (template)"
fi

# Or check inside running container
docker exec flowise-main env | grep JWT_AUTH_TOKEN_SECRET

# If you see placeholder value like "CHANGE-THIS":
# → You're using the template, not your config!
```

---

## 📚 File Structure Reference

```
docker/
├── .env.queue-source              ✅ In git (template)
│   Contains: PLACEHOLDER values
│   Example: JWT_AUTH_TOKEN_SECRET=CHANGE-THIS
│
├── .env.queue-source.local        ❌ NOT in git (your config)
│   Contains: REAL secrets
│   Example: JWT_AUTH_TOKEN_SECRET=xK7mN9pQ2wR5tY8zA...
│
└── deploy-queue-source.sh         ✅ In git
    Automatically uses .local if exists
```

---

## 🎯 Quick Reference

| Scenario | File Used | Action |
|----------|-----------|--------|
| First time setup | `.env.queue-source` → creates `.local` | Edit `.local` with secrets |
| Normal deployment | `.env.queue-source.local` | Script auto-detects |
| After git pull | `.env.queue-source.local` | Your config preserved |
| Team member setup | Auto-creates `.local` from template | Edit with their secrets |

---

## ✅ Benefits of This Approach

1. **Automatic** - Script chooses correct file
2. **Safe** - Secrets in `.local` (not committed)
3. **Team-Friendly** - Template in git, each member has own `.local`
4. **Update-Safe** - Git pulls update template, your `.local` untouched
5. **Clear** - Script shows which file it's using

---

## 🆘 Troubleshooting

### Issue: "Using .env.queue-source (template)" Warning

**Cause:** `.env.queue-source.local` doesn't exist

**Fix:**
```bash
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local  # Add your secrets
```

### Issue: Changes Not Applied

**Cause:** Editing wrong file

**Check:**
```bash
# Verify which file the script will use
cd docker
ls -la .env.queue-source*

# Should see:
# .env.queue-source       (template)
# .env.queue-source.local (your config) ← Script uses this!

# Edit the right file
nano .env.queue-source.local
```

### Issue: Container Has Wrong Secrets

**Cause:** Using template instead of `.local`

**Fix:**
```bash
# Check what container sees
docker exec flowise-main env | grep JWT_AUTH_TOKEN_SECRET

# If shows "CHANGE-THIS" → using template!
# Create/edit .local file
cp .env.queue-source .env.queue-source.local
nano .env.queue-source.local

# Restart
./deploy-queue-source.sh restart
```

---

## 💡 Pro Tips

1. **Never edit `.env.queue-source`** - it's just a template
2. **Always edit `.env.queue-source.local`** - your actual config
3. **Check script output** - shows which file is being used
4. **Keep `.local` backed up** - contains your secrets
5. **Don't commit `.local`** - already in `.gitignore`

---

## 📖 Summary

**Question:** Why does the script use `.env.queue-source` instead of `.env.queue-source.local`?

**Answer:** It doesn't anymore! After the fix, the script:
1. ✅ **Prefers** `.env.queue-source.local` (your config)
2. ⚠️ **Falls back** to `.env.queue-source` (template) if `.local` missing
3. 📢 **Tells you** which file it's using

**Result:** Your secrets are automatically used, template stays as example in git. Perfect! 🎉
