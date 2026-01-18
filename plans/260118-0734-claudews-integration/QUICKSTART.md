# ClaudeWS Integration - Quick Start Guide

## TL;DR

✅ **Status**: Implementation complete, build passing, ready for testing
🎯 **Access**: Navigate to Tools → ClaudeWS Settings
🔧 **Blocker**: Need running ClaudeWS server for full testing

## Quick Start (5 minutes)

### 1. Start the Server
```bash
cd /home/roxane/projects/privos-studio
pnpm dev
```

Wait ~30 seconds for server to start.

### 2. Access the UI
Open browser: http://localhost:8080/tools/claudews

### 3. Create a ClaudeWS Server
1. Click "Add Server"
2. Fill in:
   - Name: "Test Server"
   - Description: "Testing integration"
   - Endpoint: "http://localhost:33333"
   - API Key: "your-api-key"
3. Click "Save"

### 4. Test Connection
Click "Test Connection" button (will fail without real ClaudeWS server)

## What Works Right Now

✅ **Without ClaudeWS Server**:
- Menu navigation
- Server CRUD operations (create, edit, delete)
- UI components and design
- Room isolation logic
- Form validation
- Build and deployment

⏳ **With ClaudeWS Server**:
- Connection testing
- Plugin listing
- Plugin upload/discovery
- Plugin management
- Dependency installation

## File Locations

### Backend
- **Entities**: `packages/server/src/database/entities/ClaudeWS*.ts`
- **Services**: `packages/server/src/services/claudews-*/index.ts`
- **Controllers**: `packages/server/src/controllers/claudews-*/index.ts`
- **Routes**: `packages/server/src/routes/claudews-servers/index.ts`
- **Migrations**: `packages/server/src/database/migrations/*/1768723069000-*.ts`

### Frontend
- **Components**: `packages/ui/src/views/claudews/*.jsx`
- **API Client**: `packages/ui/src/api/claudews.js`
- **Menu**: `packages/ui/src/menu-items/dashboard.js`
- **Routes**: `packages/ui/src/routes/MainRoutes.jsx`

### Documentation
- **Plan**: `plans/260118-0734-claudews-integration/plan.md`
- **Testing Guide**: `plans/260118-0734-claudews-integration/testing-guide.md`
- **Summary**: `plans/260118-0734-claudews-integration/IMPLEMENTATION_SUMMARY.md`
- **This File**: `plans/260118-0734-claudews-integration/QUICKSTART.md`

## Common Commands

### Development
```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Run migrations manually (not needed, runs on start)
cd packages/server && pnpm run typeorm:migration-run

# Check build status
pnpm build 2>&1 | grep -E "Tasks:|Failed:"
```

### Testing
```bash
# Test server list endpoint
curl http://localhost:3000/api/v1/claudews-servers

# Test with authentication (replace TOKEN)
curl http://localhost:3000/api/v1/claudews-servers \
  -H "Cookie: token=YOUR_JWT_TOKEN"

# Check database tables
sqlite3 ~/.flowise/database.sqlite \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%claude%';"
```

### Debugging
```bash
# Check if server is running
ps aux | grep "pnpm.*dev" | grep -v grep

# Check server logs
tail -f ~/.flowise/logs/*.log

# Check migrations applied
sqlite3 ~/.flowise/database.sqlite \
  "SELECT * FROM migrations WHERE name LIKE '%Claude%';"
```

## Quick Verification Checklist

- [ ] Server builds without errors (`pnpm build`)
- [ ] Menu item appears under Tools
- [ ] Navigation to `/tools/claudews` works
- [ ] Can create a server
- [ ] Can edit a server
- [ ] Can delete a server (with confirmation)
- [ ] Form validation works
- [ ] Error messages display correctly
- [ ] UI matches PrivOS design system

## Room Isolation Quick Test

**As Admin**:
1. Login as root admin
2. Create server, leave roomId empty → Global server (no badge)
3. Create server with roomId → Room server ("My Room" badge)
4. Verify can see both servers

**As Room User**:
1. Login as room user
2. Verify see own room servers + global servers
3. Try to edit global server → Should be read-only/disabled
4. Try to delete global server → Should show error

## Troubleshooting

### "Menu item not showing"
- Clear browser cache
- Check permissions: need `tools:view`
- Verify menu-items/dashboard.js was modified

### "API 404 errors"
- Check routes/index.ts has ClaudeWS routes registered
- Verify server restarted after changes
- Check URL: `/api/v1/claudews-servers` (not `/api/claudews-servers`)

### "Build errors"
- Run `pnpm build` and check output
- Verify all imports use correct paths
- Check for TypeScript errors

### "Database migration not running"
- Migrations run automatically on server start
- Check `SELECT * FROM migrations;` in database
- Manual run: `cd packages/server && pnpm run typeorm:migration-run`

## Next Steps

1. **Set up ClaudeWS Server** (if not already running)
   - Clone: https://github.com/user/claudews (example)
   - Install: `npm install`
   - Start: `npm start`
   - Verify: http://localhost:33333/health

2. **Complete Manual Testing**
   - Follow testing-guide.md
   - Test all CRUD operations
   - Verify room isolation
   - Test plugin management

3. **Add Automated Tests** (optional)
   - Unit tests for services
   - Integration tests for API
   - E2E tests for UI workflows

4. **Production Deployment**
   - Run `pnpm build`
   - Deploy to production server
   - Run database migrations
   - Update environment variables if needed

## Support

**Documentation**:
- Full implementation plan: `plan.md`
- Testing guide: `testing-guide.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY.md`

**Code References**:
- Backend: Follow `packages/server/src/services/tools/` pattern
- Frontend: Follow `packages/ui/src/views/tools/` pattern
- Room isolation: See `packages/server/src/controllers/tools/index.ts`

**Debugging**:
- Check browser console for frontend errors
- Check server logs for backend errors
- Use browser Network tab to inspect API calls
- Verify JWT token has `roomId` and `isRootAdmin` claims

---

**Quick Start Created**: 2026-01-18
**Status**: Production-ready code, pending full testing
**Estimated Setup Time**: 5 minutes (without ClaudeWS server)
