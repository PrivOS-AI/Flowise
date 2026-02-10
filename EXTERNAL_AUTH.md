# External Authentication for Flowise

Simple JWT-based authentication integration for Flowise. No secret keys, no complex configuration - just one URL.

## Quick Setup

### 1. Add Configuration

Add to `.env`:

```bash
EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me
```

### 2. Restart Flowise

```bash
npm run build
npm run start
```

### 3. Done!

That's it. No secret keys, no service configurations needed.

---

## Usage

### SSO (Single Sign-On)

Redirect users from your service to Flowise with token and userId:

```
https://flowise.example.com/api/v1/external-sso?token=<AUTH_TOKEN>&userId=<USER_ID>
```

User is automatically logged in and redirected to dashboard.

**With custom redirect:**

```
https://flowise.example.com/api/v1/external-sso?token=<AUTH_TOKEN>&userId=<USER_ID>&redirect=/chatflows/123
```

**Example with Rocket.Chat:**

```
https://flowise.example.com/api/v1/external-sso?token=8LG2ij8tOpkDM4Pgr7D52Wr6BpeQIv7rci-deZsNI6p&userId=deLbd57rqS2yZNrGw
```

### API Calls

Call Flowise API with token (optionally with userId):

```bash
# With Authorization Bearer header
curl -X GET https://flowise.example.com/api/v1/chatflows \
  -H "Authorization: Bearer <AUTH_TOKEN>"

# With Rocket.Chat headers
curl -X GET https://flowise.example.com/api/v1/chatflows \
  -H "X-Auth-Token: <AUTH_TOKEN>" \
  -H "X-User-Id: <USER_ID>"
```

---

## How It Works

1. User has auth token and userId from external auth service (e.g., Rocket.Chat)
2. Redirect to Flowise SSO endpoint with token and userId in query params
3. Flowise calls `EXTERNAL_AUTH_PROFILE_URL` with X-Auth-Token and X-User-Id headers
4. Profile API returns user data (id, email, roles, name)
5. Flowise automatically maps user roles to permissions
6. User is logged in with appropriate access level

```
External Auth Service (e.g., Rocket.Chat)
    ↓ User login
Auth Token + User ID
    ↓ Redirect
Flowise SSO Endpoint
    ↓ Validate token
Profile API: GET /api/v1/me
    Headers:
      X-Auth-Token: <token>
      X-User-Id: <userId>
    ↓ Return user info
Flowise: Map roles → permissions
    ↓
User logged in with permissions
```

---

## Permission Mapping

User roles are automatically mapped to Flowise permissions:

| Role | Permissions |
|------|-------------|
| `admin` | All permissions (full access) |
| `bot` | `chatflows:view`, `chatflows:create`, `credentials:view` |
| `user` | `chatflows:view`, `credentials:view` (read-only) |
| other | `chatflows:view` (minimal access) |

### Available Permissions

- `chatflows:view`, `chatflows:create`, `chatflows:update`, `chatflows:delete`
- `credentials:view`, `credentials:create`, `credentials:update`, `credentials:delete`
- `tools:view`, `tools:create`
- `assistants:view`, `assistants:create`

---

## Examples

### Rocket.Chat Integration

```typescript
// In Rocket.Chat app/bot
const token = Meteor.localStorage.getItem('Meteor.loginToken')
const userId = Meteor.userId()

// Redirect to Flowise with auto-login
window.location.href = `https://flowise.example.com/api/v1/external-sso?token=${token}&userId=${userId}`
```

### Custom Auth Service

```typescript
// After user login
const token = userAuthToken // Your auth token
const userId = currentUserId // Your user ID

// Redirect to Flowise
window.location.href = `https://flowise.example.com/api/v1/external-sso?token=${token}&userId=${userId}&redirect=/chatflows`
```

### API Integration

```typescript
// Option 1: With Authorization Bearer header
const response = await fetch('https://flowise.example.com/api/v1/chatflows', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})

// Option 2: With Rocket.Chat headers
const response = await fetch('https://flowise.example.com/api/v1/chatflows', {
  headers: {
    'X-Auth-Token': userToken,
    'X-User-Id': userId
  }
})

const chatflows = await response.json()
```

---

## Profile API Requirements

Your profile API endpoint must:

1. **Accept** headers:
   - `X-Auth-Token: <token>` (required)
   - `X-User-Id: <userId>` (optional, recommended for Rocket.Chat)

   Note: Authorization Bearer format also supported but X-Auth-Token is preferred

2. **Return** JSON with user information:

```json
{
  "_id": "user123",              // or "id" or "userId"
  "email": "user@example.com",   // or in "emails" array
  "name": "John Doe",            // or "displayName" or "username"
  "roles": ["admin", "user"]     // array of role strings
}
```

**Supported formats:**

- Rocket.Chat format (with `_id`, `emails` array, `roles`)
- Generic format (with `id`, `email`, `name`, `roles`)
- Mix of both

---

## Security

### Production Checklist

- [ ] Enable HTTPS (`NODE_ENV=production`)
- [ ] Configure CORS if needed:
  ```bash
  CORS_ORIGINS=https://your-auth-service.com
  ```
- [ ] Set short token expiration in your auth service
- [ ] Monitor authentication logs
- [ ] Use secure cookies (automatic in production)

### Security Features

- ✅ Token validated by calling external API (no local verification)
- ✅ No secret keys stored in Flowise
- ✅ Session cookies are httpOnly and secure (in production)
- ✅ Tokens expire based on your auth service configuration
- ✅ RBAC permission checks on every request

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "External auth not configured" | Add `EXTERNAL_AUTH_PROFILE_URL` to `.env` and restart |
| "Token validation failed" | Token expired or invalid - get new token from auth service |
| "Invalid user data" | Profile API not returning required fields (id, email) |
| "Forbidden" (403) | User's role not mapped to required permission |
| 503 Service Unavailable | Profile API is down or unreachable |

### Debug Logs

Enable debug logging:

```bash
DEBUG=true
LOG_LEVEL=debug
```

Check logs for:
- `[ExternalAuth]: Validating token with profile URL`
- `[ExternalAuth]: Authenticated user <email> with roles: <roles>`
- `[ExternalSSO]: User <email> logged in successfully`

---

## Implementation Details

### Files Modified

**New Files:**
- `packages/server/src/middlewares/externalAuth.ts` - Authentication middleware
- `packages/server/src/routes/external-sso/index.ts` - SSO endpoints
- `.env.external-auth.example` - Configuration example

**Modified Files:**
- `packages/server/src/index.ts` - Added external auth middleware
- `packages/server/src/routes/index.ts` - Added SSO router
- `packages/server/src/utils/constants.ts` - Whitelisted SSO endpoint

**Untouched:**
- `packages/server/src/enterprise/` - No enterprise code modified ✅
- `packages/server/src/IdentityManager.ts` - Not modified ✅

### License Compliance

- ✅ 100% Apache 2.0 compliant
- ✅ No modifications to enterprise/commercial code
- ✅ All new code in Apache 2.0 areas
- ✅ Reuses existing RBAC infrastructure

---

## API Endpoints

### SSO Login

```
GET /api/v1/external-sso?token=<AUTH_TOKEN>&userId=<USER_ID>&redirect=<PATH>
```

**Query Parameters:**
- `token` (required) - Authentication token
- `userId` (required) - User ID
- `redirect` (optional) - Path to redirect after login (default: `/`)

**Response:**
- 302 Redirect to dashboard with session cookie

### Logout

```
POST /api/v1/external-sso/logout?returnUrl=<URL>
```

**Query Parameters:**
- `returnUrl` (optional) - URL to redirect after logout

**Response:**
- Clear session cookies
- 302 Redirect or JSON success message

---

## Configuration Reference

### Environment Variables

```bash
# Required
EXTERNAL_AUTH_PROFILE_URL=<profile-api-url>

# Optional - Standard Flowise config
NODE_ENV=production                    # Enable HTTPS, secure cookies
CORS_ORIGINS=<allowed-origins>         # Configure CORS
APP_URL=<flowise-url>                  # Base URL for redirects
JWT_AUTH_TOKEN_SECRET=<secret>         # Session token secret
JWT_ISSUER=<issuer>                    # JWT issuer
JWT_AUDIENCE=<audience>                # JWT audience
```

### Example Configuration

```bash
# Minimal setup
EXTERNAL_AUTH_PROFILE_URL=https://privos-web-dev.roxane.one/api/v1/me

# Production setup
NODE_ENV=production
EXTERNAL_AUTH_PROFILE_URL=https://auth.example.com/api/v1/me
CORS_ORIGINS=https://auth.example.com
APP_URL=https://flowise.example.com
```

---

## Support

For issues:

1. Check configuration in `.env`
2. Review Flowise logs (enable `DEBUG=true`)
3. Verify profile API is accessible and returns correct format
4. Test token with curl:
   ```bash
   curl -H "X-Auth-Token: <token>" -H "X-User-Id: <userId>" <EXTERNAL_AUTH_PROFILE_URL>
   ```

---

## Summary

| Feature | Status |
|---------|--------|
| **Configuration** | ✅ One line |
| **Secret Keys** | ❌ Not needed |
| **SSO Support** | ✅ Yes |
| **API Auth** | ✅ Yes |
| **Auto Permissions** | ✅ Yes |
| **Rocket.Chat** | ✅ Supported |
| **License Compliant** | ✅ 100% |

**Simple, secure, and compliant external authentication for Flowise.** 🚀
