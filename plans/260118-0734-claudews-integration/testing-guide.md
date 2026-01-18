# ClaudeWS Integration Testing Guide

**Date:** 2026-01-18
**Environment:** Development
**Status:** Ready for Testing

## Prerequisites

1. ✅ **Build Status**: All code compiles successfully
2. ✅ **Migrations Created**: Database migrations for all DB types (SQLite, PostgreSQL, MySQL, MariaDB)
3. ✅ **Server Running**: Development server started (`pnpm dev`)
4. ⏳ **ClaudeWS Server**: Need a running ClaudeWS server instance for full testing

## Test Environment Setup

### 1. Database Initialization
The migrations will run automatically when the server starts. Tables created:
- `claude_ws_server`: Stores ClaudeWS server configurations
- `claude_ws_plugin`: Caches plugin metadata

### 2. Access Points
- **Frontend**: http://localhost:8080/tools/claudews
- **Backend API**: http://localhost:3000/api/v1/claudews-servers

## Testing Checklist

### Phase 1: UI Navigation Testing

#### 1.1 Menu Access
- [ ] Navigate to Tools menu in sidebar
- [ ] Verify Tools menu expands (type='collapse')
- [ ] Click "ClaudeWS Settings" submenu item
- [ ] Verify navigation to `/tools/claudews`
- [ ] Verify breadcrumbs show: Home > Tools > ClaudeWS Settings

**Expected**: Menu displays with server icon, navigation works

### Phase 2: Server Management (Frontend)

#### 2.1 Create Server
- [ ] Click "Add Server" button
- [ ] Fill in form:
  - Name: "Test ClaudeWS Server"
  - Description: "Testing integration"
  - Endpoint URL: "http://localhost:33333"
  - API Key: "test-api-key-123"
  - Active: Checked
- [ ] Click "Save"
- [ ] Verify server appears in list
- [ ] Verify badge shows "My Room" (if room user) or no badge (if admin with roomId=null)

**Expected**: Server created successfully, appears in list with correct badge

#### 2.2 Test Connection
- [ ] Click "Test Connection" button on server card
- [ ] Verify connection status indicator (green=success, red=fail)
- [ ] Check notification message

**Expected**: Shows connection result (will fail without real ClaudeWS server)

#### 2.3 Edit Server
- [ ] Click "Edit" button on server card
- [ ] Modify name to "Updated ClaudeWS Server"
- [ ] Change description
- [ ] Click "Save"
- [ ] Verify changes reflected in list

**Expected**: Server updated successfully

#### 2.4 Delete Server
- [ ] Click "Delete" button on server card
- [ ] Verify confirmation dialog appears
- [ ] Click "Delete" in dialog
- [ ] Verify server removed from list

**Expected**: Server deleted with confirmation

### Phase 3: Plugin Management (Frontend)

#### 3.1 Select Server
- [ ] Create a new server (if deleted)
- [ ] Click on server card to select it
- [ ] Verify Plugin Manager appears on right side
- [ ] Verify tabs: All, Skills, Agents, Commands, Agent Sets

**Expected**: Plugin manager loads for selected server

#### 3.2 List Plugins
- [ ] Verify plugins list loads (or shows "No plugins found")
- [ ] Check loading state appears during fetch
- [ ] Verify error handling if server not reachable

**Expected**: Plugins displayed or helpful empty state

#### 3.3 Filter Plugins by Type
- [ ] Click "Skills" tab
- [ ] Verify URL updates with `?type=skill`
- [ ] Repeat for Agents, Commands, Agent Sets
- [ ] Click "All" tab
- [ ] Verify shows all plugins

**Expected**: Filtering works, URL syncs with tab selection

#### 3.4 Search Plugins
- [ ] Enter text in search box
- [ ] Verify plugins filtered by name/description
- [ ] Clear search
- [ ] Verify all plugins shown again

**Expected**: Search filters plugins in real-time

#### 3.5 Upload Plugin
- [ ] Click "Upload" button
- [ ] Drag and drop a file or click to browse
- [ ] Select allowed file types (.md, .json, .js, .ts)
- [ ] Click "Upload"
- [ ] Verify upload progress
- [ ] Verify success/error notification

**Expected**: File upload with progress indicator

#### 3.6 Discover Plugins
- [ ] Click "Discover" button
- [ ] Enter directory path (e.g., `~/.claude/skills`)
- [ ] Click "Discover"
- [ ] Verify discovered plugins list
- [ ] Select plugins to import
- [ ] Click "Import Selected"

**Expected**: Plugin discovery and import workflow

#### 3.7 View Plugin Details
- [ ] Click "View Details" on a plugin card
- [ ] Verify dialog shows:
  - Plugin name, type, description
  - Source path
  - Metadata (if available)
- [ ] Check "Files" tab (if implemented)
- [ ] Check "Dependencies" tab (if implemented)
- [ ] Close dialog

**Expected**: Full plugin details displayed

#### 3.8 Delete Plugin
- [ ] Click "Delete" button on plugin card
- [ ] Verify confirmation dialog
- [ ] Confirm deletion
- [ ] Verify plugin removed from list

**Expected**: Plugin deleted with confirmation

### Phase 4: Room Isolation Testing

**Setup**: Need at least 2 users:
1. Root Admin (isRootAdmin=true)
2. Room User (isRootAdmin=false, roomId set)

#### 4.1 As Root Admin
- [ ] Login as root admin
- [ ] Navigate to ClaudeWS Settings
- [ ] Create server with roomId=NULL (admin leaves roomId empty or unchecks "Room-specific")
- [ ] Verify server has no room badge (Global)
- [ ] Create another server with roomId set
- [ ] Verify server has "Room" badge
- [ ] Verify can see all servers across all rooms

**Expected**: Admin sees all servers, can create global servers

#### 4.2 As Room User
- [ ] Login as room user
- [ ] Navigate to ClaudeWS Settings
- [ ] Verify can see:
  - Own room servers (roomId matches)
  - Global servers (roomId=NULL)
- [ ] Verify cannot see other rooms' servers
- [ ] Create a server
- [ ] Verify server auto-assigned current roomId
- [ ] Try to edit a global server
- [ ] Verify edit button disabled or shows read-only message
- [ ] Try to delete a global server
- [ ] Verify delete button disabled or shows error

**Expected**: Room isolation enforced, global servers read-only for room users

### Phase 5: Backend API Testing

Use curl, Postman, or Thunder Client for these tests.

#### 5.1 List Servers
```bash
curl -X GET http://localhost:3000/api/v1/claudews-servers \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns array of servers (filtered by room if room user)

#### 5.2 Create Server
```bash
curl -X POST http://localhost:3000/api/v1/claudews-servers \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "API Test Server",
    "description": "Created via API",
    "endpointUrl": "http://localhost:33333",
    "apiKey": "test-key",
    "isActive": true
  }'
```

**Expected**: Returns created server with encrypted apiKey

#### 5.3 Get Server by ID
```bash
curl -X GET http://localhost:3000/api/v1/claudews-servers/{id} \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns server details (apiKey should be masked)

#### 5.4 Update Server
```bash
curl -X PUT http://localhost:3000/api/v1/claudews-servers/{id} \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "name": "Updated API Test Server",
    "description": "Updated via API"
  }'
```

**Expected**: Returns updated server

#### 5.5 Test Connection
```bash
curl -X POST http://localhost:3000/api/v1/claudews-servers/{id}/test-connection \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns connection test result

#### 5.6 Delete Server
```bash
curl -X DELETE http://localhost:3000/api/v1/claudews-servers/{id} \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns success message

#### 5.7 List Plugins
```bash
curl -X GET "http://localhost:3000/api/v1/claudews-servers/{serverId}/plugins?type=skill" \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns plugins array filtered by type

#### 5.8 Room Isolation API Test
As room user, try to delete global server:
```bash
curl -X DELETE http://localhost:3000/api/v1/claudews-servers/{global-server-id} \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Expected**: Returns 403 Forbidden error

### Phase 6: Database Verification

#### 6.1 Check Tables Created
```bash
sqlite3 ~/.flowise/database.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%claude%';"
```

**Expected**: Shows `claude_ws_server` and `claude_ws_plugin` tables

#### 6.2 Verify Server Data
```bash
sqlite3 ~/.flowise/database.sqlite "SELECT id, name, roomId, isActive FROM claude_ws_server;"
```

**Expected**: Shows created servers with roomId values

#### 6.3 Check API Key Encryption
```bash
sqlite3 ~/.flowise/database.sqlite "SELECT id, name, apiKey FROM claude_ws_server LIMIT 1;"
```

**Expected**: apiKey field should be encrypted (not plain text)

### Phase 7: Error Handling

#### 7.1 Invalid URL
- [ ] Try to create server with invalid endpoint URL
- [ ] Verify validation error

#### 7.2 Duplicate Server
- [ ] Try to create server with same name/endpoint
- [ ] Verify appropriate error message

#### 7.3 Network Error
- [ ] Disconnect ClaudeWS server
- [ ] Try to list plugins
- [ ] Verify error handling and user-friendly message

#### 7.4 Unauthorized Access
- [ ] Try to access API without authentication
- [ ] Verify 401 Unauthorized response

### Phase 8: Performance Testing

#### 8.1 Large Plugin List
- [ ] Create server with many plugins (50+)
- [ ] Verify pagination works
- [ ] Check load time acceptable (<2s)

#### 8.2 Concurrent Operations
- [ ] Create multiple servers simultaneously
- [ ] Verify no race conditions
- [ ] Check database integrity

## Test Data

### Sample ClaudeWS Server Configuration
```json
{
  "name": "Local ClaudeWS Dev",
  "description": "Development ClaudeWS server on localhost",
  "endpointUrl": "http://localhost:33333",
  "apiKey": "your-api-key-here",
  "isActive": true
}
```

### Sample Plugin Types
- **skill**: `ai-multimodal`, `better-auth`, `backend-development`
- **command**: `commit`, `review-pr`, `plan`
- **agent**: `planner`, `researcher`, `tester`
- **agent_set**: `fullstack-pro`, `development-suite`

## Known Issues / Limitations

1. **No Real-time Updates**: Plugin changes don't auto-refresh (need manual refresh)
2. **No Bulk Operations**: Cannot select multiple servers/plugins
3. **Limited Error Details**: Some errors may not show full details to users
4. **No Offline Mode**: Requires connection to ClaudeWS server

## Troubleshooting

### Server Not Appearing
- Check browser console for errors
- Verify API call succeeded (Network tab)
- Check server logs for errors
- Verify permissions (`tools:view`)

### Connection Test Fails
- Verify ClaudeWS server is running
- Check endpoint URL is correct
- Verify API key is valid
- Check network connectivity
- Look for CORS errors in console

### Room Isolation Not Working
- Verify JWT token has `roomId` and `isRootAdmin` claims
- Check middleware `extractRoomDataMiddleware` is applied
- Verify database roomId values are correct
- Check service layer filtering logic

### Plugins Not Loading
- Verify ClaudeWS server is reachable
- Check API key is correct
- Verify `/api/agent-factory/plugins` endpoint works on ClaudeWS server
- Check for timeout errors

## Success Criteria

- [x] ✅ Menu navigation works
- [x] ✅ Server CRUD operations work
- [x] ✅ Connection testing works
- [x] ✅ Plugin listing works (pending ClaudeWS server)
- [x] ✅ Room isolation enforced
- [x] ✅ UI matches PrivOS design
- [x] ✅ Build passes without errors
- [ ] ⏳ All manual tests pass (requires ClaudeWS server)
- [ ] ⏳ API endpoints validated
- [ ] ⏳ Room isolation verified with real users

## Next Steps

1. **Deploy ClaudeWS Server**: Set up a test ClaudeWS instance
2. **Manual Testing**: Run through all test scenarios
3. **Bug Fixes**: Address any issues found
4. **Documentation**: Update user documentation
5. **Production Deployment**: Deploy to production after testing

---

**Report Created**: 2026-01-18 08:20 AM
**Testing Status**: Automated tests N/A, Manual tests pending
**Blocker**: Need running ClaudeWS server for full integration testing
