# ClaudeWS Menu Not Showing - Troubleshooting Guide

**Issue:** ClaudeWS Settings submenu not appearing under Tools menu

## Quick Fix (Most Common)

### 1. Hard Refresh Browser
The menu changes are in the code but your browser has cached the old version.

**Chrome/Edge/Brave:**
- Press: `Ctrl + Shift + R` (Linux/Windows)
- Or: `Cmd + Shift + R` (Mac)

**Firefox:**
- Press: `Ctrl + F5` (Linux/Windows)
- Or: `Cmd + Shift + R` (Mac)

**Alternative: Clear Cache Manually**
1. Open browser DevTools (F12)
2. Right-click on the refresh button
3. Select "Empty Cache and Hard Reload"

### 2. Verify You're Logged In
- Navigate to: http://localhost:10001
- Make sure you're logged into PrivOS Studio
- Check that you have `tools:view` permission

### 3. Check Console for Errors
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any red errors
4. Share error messages if any

## Verification Steps

### Step 1: Confirm Server is Running
```bash
# Backend should be on port 3002
curl http://localhost:3002/api/v1/claudews-servers
# Should return: {"error":"Unauthorized Access"}

# Frontend should be on port 10001
curl http://localhost:10001
# Should return HTML
```

### Step 2: Verify Menu Configuration
The menu file has been updated correctly:
- File: `packages/ui/src/menu-items/dashboard.js`
- Lines 117-142: Tools menu with ClaudeWS Settings child

### Step 3: Verify Route Registration
Route is registered:
- File: `packages/ui/src/routes/MainRoutes.jsx`
- Path: `/tools/claudews`
- Component: `ClaudeWS`

## Expected Menu Structure

When working correctly, you should see:

```
Tools (expandable arrow icon)
  ├─ Tools (main tools page)
  └─ ClaudeWS Settings (with server icon)
```

Click on "Tools" to expand the submenu, then click "ClaudeWS Settings".

## Advanced Troubleshooting

### Check Browser Network Tab
1. Open DevTools (F12) → Network tab
2. Refresh page
3. Look for `dashboard.js` file
4. Click on it and check Response tab
5. Search for "claudews-settings" in the response
6. If not found: Vite might be serving old cached files

### Clear Vite Cache
```bash
cd /home/roxane/projects/privos-studio
rm -rf packages/ui/node_modules/.vite
pnpm dev
```

### Check if Menu Component Renders
1. Open DevTools (F12) → Console
2. Type: `document.querySelector('[href="/tools/claudews"]')`
3. If null: Menu item not rendered (permission issue or browser cache)
4. If HTMLElement: Menu item exists (might be hidden or permission blocked)

### Verify Permissions
Check your JWT token has correct permissions:
1. Open DevTools → Application → Cookies
2. Find `token` cookie
3. Decode JWT at https://jwt.io
4. Check claims include:
   - `permissions` array with "tools:view" or "*:*"
   - `isRootAdmin: true` (or your role permissions)

## Still Not Working?

### Option 1: Direct URL Navigation
Try accessing directly:
```
http://localhost:10001/tools/claudews
```

If this works, menu configuration is fine - it's a rendering issue.

### Option 2: Incognito/Private Window
Open the app in an incognito/private browser window:
```
http://localhost:10001
```

If it works there, it's definitely a cache issue.

### Option 3: Different Browser
Try accessing from a different browser (Chrome, Firefox, Edge).

### Option 4: Check Build Files
Verify the menu file is being served:
```bash
# Check if source file has the changes
grep -A 5 "claudews-settings" packages/ui/src/menu-items/dashboard.js

# Should output the ClaudeWS menu item configuration
```

## Server Logs

If the menu still doesn't show, check server logs:
```bash
tail -100 /tmp/dev-server.log | grep -E "error|Error|ERROR|fail"
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Menu item not visible | Browser cache | Hard refresh (Ctrl+Shift+R) |
| Submenu doesn't expand | JavaScript error | Check console for errors |
| "Unauthorized" on page | No JWT token | Login first |
| "Permission denied" | Missing tools:view permission | Ask admin to grant permission |
| Blank page at /tools/claudews | Component not loaded | Check browser console |
| Menu shows but clicking does nothing | React Router issue | Refresh page, check console |

## Debug Checklist

- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Logged into PrivOS Studio
- [ ] Have `tools:view` permission
- [ ] Server running on port 3002
- [ ] Frontend running on port 10001
- [ ] No errors in browser console
- [ ] Tried incognito/private window
- [ ] Tried different browser
- [ ] Verified JWT token permissions
- [ ] Checked menu file has changes
- [ ] Route exists in MainRoutes.jsx

## Expected Behavior

After a hard refresh, you should see:

1. **Main Menu:**
   - Tools (with down arrow indicating expandable)

2. **Click on Tools:**
   - Expands to show:
     - Tools (main page)
     - ClaudeWS Settings (with server icon)

3. **Click on ClaudeWS Settings:**
   - Navigates to `/tools/claudews`
   - Shows ClaudeWS integration page
   - Split layout: Server list (left) + Plugin manager (right)

## Contact Info

If issue persists after trying all troubleshooting steps:
1. Share browser console errors
2. Share server logs from /tmp/dev-server.log
3. Confirm what you see in the menu (screenshot helpful)
4. Confirm URL you're accessing

---

**Last Updated:** 2026-01-18 08:47 AM
**Server Status:** ✅ Running (port 3002: backend, port 10001: frontend)
**Menu Configuration:** ✅ Correct (verified in dashboard.js)
**Route Registration:** ✅ Correct (verified in MainRoutes.jsx)
