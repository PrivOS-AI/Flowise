# 📝 Environment Files Guide

## 🔐 Security Best Practices

### ✅ Files to COMMIT to Git (Templates)

These are **templates/examples** without secrets - safe to commit:

```bash
.env.example                    # Original template
.env.queue-source              # Queue mode template (the one I created)
README.md                      # Documentation
QUEUE-SOURCE-SETUP.md          # Setup guide
QUICK-START.md                 # Quick start guide
deploy-queue-source.sh         # Deployment script
```

### ❌ Files to EXCLUDE from Git (Actual Configs)

These contain **actual secrets and passwords** - NEVER commit:

```bash
.env                           # Your actual config
.env.local                     # Local config with secrets
.env.queue-source.local        # Your queue config (use this!)
.env.production                # Production secrets
.env.development               # Development secrets
```

---

## 📁 File Naming Convention

| File Pattern | Purpose | Git? |
|-------------|---------|------|
| `.env.example` | Template/sample | ✅ Commit |
| `.env.queue-source` | Template/sample | ✅ Commit |
| `.env` | Actual config | ❌ Ignore |
| `.env.local` | Actual config | ❌ Ignore |
| `.env.*.local` | Actual config | ❌ Ignore |
| `.env.production` | Actual config | ❌ Ignore |

---

## 🔧 Setup Workflow

### For New Developers

```bash
# 1. Clone repo (templates included)
git clone <repo>
cd Flowise/docker

# 2. Create your local config from template
cp .env.queue-source .env.queue-source.local

# 3. Edit with your secrets (NOT committed to git)
nano .env.queue-source.local

# 4. Deploy
./deploy-queue-source.sh start
```

### For Existing Setup

```bash
# Your .env.queue-source.local is already ignored by git
# So you can safely:
git pull    # Get latest templates
            # Your .env.queue-source.local stays untouched
```

---

## ✅ Current .gitignore Rules

The following patterns are ignored:

```gitignore
# General env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Docker-specific env files
docker/.env
docker/.env.local
docker/.env.queue-source.local
docker/.env.production
```

---

## 🚨 Security Checklist

Before committing:

```bash
# 1. Check what you're about to commit
git status

# 2. Make sure no .env files with secrets are staged
git diff --cached | grep -i "password\|secret\|key"

# 3. Verify .gitignore is working
git check-ignore docker/.env.queue-source.local
# Should output: docker/.env.queue-source.local

# 4. If you accidentally added a secret file:
git reset HEAD docker/.env.queue-source.local
```

---

## 📋 Common Scenarios

### Scenario 1: Share Template with Team

```bash
# Edit the template (no secrets!)
nano .env.queue-source

# Commit it
git add docker/.env.queue-source
git commit -m "docs: update env template with new options"
git push
```

### Scenario 2: Update Your Local Config

```bash
# Your local config is NOT in git
nano docker/.env.queue-source.local

# No git commands needed - it's ignored!
```

### Scenario 3: New Team Member Setup

```bash
# They clone repo
git clone <repo>

# They create their config
cd Flowise/docker
cp .env.queue-source .env.queue-source.local

# They add their secrets
nano .env.queue-source.local

# Git will automatically ignore it
```

### Scenario 4: Accidentally Committed Secrets

```bash
# If you haven't pushed yet:
git reset HEAD docker/.env.queue-source.local
git checkout -- docker/.env.queue-source.local

# If you already pushed:
# 1. Remove from git history (use git-filter-branch or BFG)
# 2. Rotate all exposed secrets immediately!
# 3. Force push (with caution)
```

---

## 🎯 Recommended File Structure

```
docker/
├── .env.example                    ✅ In git (template)
├── .env.queue-source              ✅ In git (template)
├── .env.queue-source.local        ❌ Ignored (your config)
├── docker-compose.yml             ✅ In git
├── docker-compose-queue-source.yml ✅ In git
├── docker-compose-queue-prebuilt.yml ✅ In git
├── deploy-queue-source.sh         ✅ In git
├── README.md                      ✅ In git
├── QUEUE-SOURCE-SETUP.md          ✅ In git
├── QUICK-START.md                 ✅ In git
└── ENV-FILES-GUIDE.md             ✅ In git (this file)
```

---

## 🔍 Verify .gitignore is Working

```bash
# Test if file is ignored
git check-ignore -v docker/.env.queue-source.local

# Should output something like:
# .gitignore:40:docker/.env.queue-source.local    docker/.env.queue-source.local

# List all ignored files in docker/
git status --ignored docker/
```

---

## 💡 Pro Tips

1. **Use `.local` suffix** - Anything with `.local` is automatically ignored
2. **Never commit real secrets** - Always use templates with placeholder values
3. **Document env vars** - Add comments in `.env.queue-source` template
4. **Use environment-specific files** - `.env.development.local`, `.env.production.local`
5. **Secret management** - For production, consider using AWS Secrets Manager, HashiCorp Vault, etc.

---

## 🆘 If You Exposed Secrets

**Immediate action required:**

1. **Stop the breach**
   ```bash
   # Remove from git history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch docker/.env.queue-source.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **Rotate all secrets immediately**
   - Change all passwords
   - Regenerate all JWT tokens
   - Revoke all API keys
   - Update database credentials

3. **Force push (with team coordination)**
   ```bash
   git push origin --force --all
   ```

4. **Notify team**
   - Inform all team members
   - Everyone must re-clone or reset

---

## 📚 Reference

- [Git Documentation: gitignore](https://git-scm.com/docs/gitignore)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Best Practices for Environment Variables](https://12factor.net/config)

---

## ✅ Summary

| File | Contains Secrets? | In Git? | Use Case |
|------|------------------|---------|----------|
| `.env.queue-source` | ❌ No (placeholders) | ✅ Yes | Template for team |
| `.env.queue-source.local` | ✅ Yes (real secrets) | ❌ No | Your actual config |

**Remember:** Templates with `CHANGE-THIS` placeholders → Git ✅
**Actual configs with real passwords** → Git ❌
