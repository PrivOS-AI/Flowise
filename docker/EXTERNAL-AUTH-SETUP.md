# 🔐 External Authentication Setup Guide

## Overview

The `EXTERNAL_AUTH_PROFILE_URL` enables SSO integration with external services like Rocket.Chat, custom authentication services, or any system that can validate JWT tokens and return user profiles.

---

## 📋 Quick Answer

**Put it in the Docker `.env` file, NOT in the server folder!**

**File location:**
```
Flowise/docker/.env.queue-source.local
```

---

## 🔧 Configuration Steps

### Step 1: Edit Your Docker Environment File

```bash
cd ~/Flowise/docker
nano .env.queue-source.local
```

### Step 2: Add/Update External Auth Configuration

Find the **EXTERNAL AUTH INTEGRATION** section and add your profile URL:

```bash
############################################################################################################
####################################### EXTERNAL AUTH INTEGRATION ##########################################
############################################################################################################

# External authentication - validate JWT tokens via profile API
# Your profile API URL that returns user information
EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me

# How it works:
#   1. User redirects to: /api/v1/external-sso?token=<JWT>
#   2. Flowise calls profile URL with: Authorization: Bearer <JWT>
#   3. Profile API returns user info (id, email, roles, name)
#   4. User is logged in with auto-mapped permissions based on roles
```

### Step 3: Restart Flowise

```bash
./deploy-queue-source.sh restart
```

---

## 🎯 Complete Example Configuration

**File: `docker/.env.queue-source.local`**

```bash
# ... other settings ...

############################################################################################################
####################################### EXTERNAL AUTH INTEGRATION ##########################################
############################################################################################################

# Set your external auth profile URL
EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me

# ... other settings ...
```

---

## 🔄 How It Works

### Flow Diagram

```
┌─────────────────┐
│  External App   │ (e.g., Rocket.Chat)
│  (Has JWT)      │
└────────┬────────┘
         │
         │ 1. Redirect with token
         │ GET /api/v1/external-sso?token=<JWT>
         ▼
┌─────────────────────────────────────┐
│  Flowise Server                     │
│  (docker container)                 │
└────────┬────────────────────────────┘
         │
         │ 2. Validate token
         │ GET EXTERNAL_AUTH_PROFILE_URL
         │ Headers: Authorization: Bearer <JWT>
         ▼
┌─────────────────────────────────────┐
│  Your Profile API                   │
│  (e.g., privos-web-dev)             │
└────────┬────────────────────────────┘
         │
         │ 3. Return user profile
         │ { id, email, name, roles }
         ▼
┌─────────────────────────────────────┐
│  Flowise Server                     │
│  - Creates/updates user             │
│  - Maps roles to permissions        │
│  - Issues JWT tokens                │
│  - Redirects to dashboard           │
└─────────────────────────────────────┘
```

---

## 📝 Expected Profile API Response

Your `EXTERNAL_AUTH_PROFILE_URL` should return JSON like this:

```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "roles": ["admin", "editor"]
}
```

**Required fields:**
- `id` or `_id` - Unique user identifier
- `email` - User email address
- `name` or `username` - Display name

**Optional fields:**
- `roles` - Array of role names (used for permission mapping)

---

## 🚀 Testing External Auth

### Test 1: Check Configuration

```bash
# Verify environment variable is set
docker exec flowise-main env | grep EXTERNAL_AUTH

# Should output:
# EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me
```

### Test 2: Test the SSO Endpoint

```bash
# Get a valid JWT token from your external service
TOKEN="your-jwt-token-here"

# Test the SSO endpoint
curl -v "http://localhost:3000/api/v1/external-sso?token=$TOKEN"
```

**Expected behavior:**
- Redirects to Flowise dashboard
- User is logged in
- Session cookie is set

### Test 3: Check Logs

```bash
# View logs for external auth activity
docker logs flowise-main -f | grep -i "external"
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: Configuration Not Applied

**Symptom:** External auth doesn't work after setting `EXTERNAL_AUTH_PROFILE_URL`

**Solution:**
```bash
# Make sure you edited the RIGHT file
cat docker/.env.queue-source.local | grep EXTERNAL_AUTH

# Restart to apply changes
cd docker
./deploy-queue-source.sh restart

# Verify in container
docker exec flowise-main env | grep EXTERNAL_AUTH
```

### Issue 2: Profile API Call Fails

**Symptom:** "Unable to fetch profile" error

**Solution:**
```bash
# Test profile API manually
TOKEN="your-test-jwt"
curl -H "Authorization: Bearer $TOKEN" \
     https://privos-web-dev.roxane.one/api/v1/me

# Check if it returns valid JSON
```

**Common causes:**
- Invalid token
- Profile API down/unreachable
- Wrong URL
- Network firewall blocking outbound requests

### Issue 3: CORS Issues

**Symptom:** Browser shows CORS error

**Solution:**
```bash
# Add your external app domain to CORS_ORIGINS
nano docker/.env.queue-source.local

# Add:
CORS_ORIGINS=https://privos-web-dev.roxane.one,http://localhost:3000

# Restart
./deploy-queue-source.sh restart
```

---

## 🔒 Security Considerations

### 1. **Use HTTPS**

```bash
# ✅ Good
EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me

# ❌ Bad (insecure)
EXTERNAL_AUTH_PROFILE_URL=http://privos-web-dev.roxane.one/api/v1/me
```

### 2. **Validate Token Expiry**

Your profile API should:
- Check JWT expiration
- Validate JWT signature
- Return 401 for invalid tokens

### 3. **Rate Limiting**

Protect your profile API:
- Implement rate limiting
- Monitor for abuse
- Log authentication attempts

### 4. **Secure Network**

```bash
# If profile API is internal, ensure Docker can reach it
# Test from inside container:
docker exec flowise-main curl -v https://privos-web-dev.roxane.one/api/v1/me
```

---

## 📊 Role Mapping

External roles are automatically mapped to Flowise permissions:

| External Role | Flowise Permission Level | Access |
|---------------|-------------------------|--------|
| `admin`, `owner` | Owner | Full access |
| `manager`, `editor` | Editor | Most features |
| `user`, `member` | Viewer | Read-only |
| (no roles) | Viewer | Read-only (default) |

**Custom role mapping** (if needed, modify in code):
- Location: `packages/server/src/routes/external-sso/index.ts`

---

## 🎯 Integration Examples

### Example 1: Rocket.Chat Integration

**Rocket.Chat sends JWT with user info:**

```javascript
// In Rocket.Chat
const jwt = generateJWT({
  userId: user._id,
  email: user.emails[0].address,
  name: user.name,
  roles: user.roles
});

// Redirect to Flowise
window.location.href = `https://flowise.yourdomain.com/api/v1/external-sso?token=${jwt}`;
```

**Flowise config:**
```bash
EXTERNAL_AUTH_PROFILE_URL=https://rocketchat.yourdomain.com/api/v1/me
```

### Example 2: Custom Auth Service

**Your auth service:**
```javascript
// GET /api/v1/me
// Headers: Authorization: Bearer <JWT>

app.get('/api/v1/me', authenticateJWT, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    roles: req.user.roles
  });
});
```

**Flowise config:**
```bash
EXTERNAL_AUTH_PROFILE_URL=https://auth.yourdomain.com/api/v1/me
```

---

## 🔄 Update Workflow

When you update code and add new env variables:

```bash
# 1. Pull latest code
cd ~/Flowise
git pull

# 2. Check if new env vars were added
git diff HEAD@{1} packages/server/.env.example

# 3. Add them to Docker env file
cd docker
nano .env.queue-source.local

# 4. Add new configuration
EXTERNAL_AUTH_PROFILE_URL=https://your-service.com/api/v1/me

# 5. Rebuild and restart
./deploy-queue-source.sh rebuild
```

---

## ✅ Configuration Checklist

- [ ] Added `EXTERNAL_AUTH_PROFILE_URL` to `docker/.env.queue-source.local`
- [ ] URL is HTTPS (secure)
- [ ] Profile API is accessible from Docker container
- [ ] Profile API returns correct JSON format
- [ ] CORS configured if needed
- [ ] Restarted Flowise containers
- [ ] Tested SSO endpoint
- [ ] Checked logs for errors

---

## 📚 File Locations Reference

### ❌ WRONG Places to Put Config

```bash
# DON'T put it here (won't work in Docker)
packages/server/.env          # ❌ Not used by Docker
packages/server/.env.local    # ❌ Not used by Docker
.env                          # ❌ Root .env ignored by Docker
```

### ✅ CORRECT Place

```bash
# Put it here (used by docker-compose)
docker/.env.queue-source.local   # ✅ This is the one!
```

---

## 🆘 Still Not Working?

### Check Environment Inside Container

```bash
# Verify the env var is set
docker exec flowise-main env | grep EXTERNAL_AUTH_PROFILE_URL

# If empty, check your .env file
cat docker/.env.queue-source.local | grep EXTERNAL_AUTH

# Restart to apply
./deploy-queue-source.sh restart
```

### Check Logs for Errors

```bash
# Follow logs
docker logs flowise-main -f

# Look for external auth errors
docker logs flowise-main 2>&1 | grep -i "external"
```

### Test Profile API Manually

```bash
# From inside container
docker exec -it flowise-main sh
curl -v -H "Authorization: Bearer YOUR_TOKEN" \
  $EXTERNAL_AUTH_PROFILE_URL
exit
```

---

## 💡 Summary

**Quick Answer:**

1. **File:** `docker/.env.queue-source.local` (NOT in server folder!)
2. **Add:** `EXTERNAL_AUTH_PROFILE_URL=https://your-profile-api.com/api/v1/me`
3. **Restart:** `./deploy-queue-source.sh restart`

**That's it!** The environment variable will be passed to the Docker container automatically. ✅
