# ClaudeWS Integration with PrivOS Studio

**Plan Date:** 2026-01-18
**Status:** Active
**Complexity:** High

## Executive Summary

Integrate ClaudeWS server management into PrivOS Studio as a nested menu under Tools, enabling users to configure ClaudeWS servers with room isolation support and manage Agent Factory plugins (Skills, Agents, Commands, Agent Sets).

### Key Features
- **ClaudeWS Server Management**: CRUD operations for ClaudeWS server configurations
- **Room Isolation**: Room-specific servers with admin ability to share globally
- **Agent Factory**: Full plugin management with discovery, filtering, and CRUD
- **Nested Menu**: Accessible under Tools menu, always visible
- **API Integration**: WebSocket and REST API integration with ClaudeWS servers

## Requirements Analysis

### User Requirements (from user input)
1. Menu nested under Tools, always visible
2. Room isolation with admin sharing capabilities
3. Add/Edit/Delete ClaudeWS servers (endpoint URL + API key)
4. Agent Factory management per server:
   - View current plugins
   - Upload/Add plugins
   - Remove plugins
   - Discover plugins
   - Filter by type: Skills, Agents, Commands, Agent Sets
5. Full CRUD + Discovery capabilities

### Technical Requirements
1. Database schema for ClaudeWS servers and plugin metadata
2. Backend API endpoints following PrivOS patterns
3. Frontend UI components matching existing design system
4. Room isolation middleware integration
5. RBAC permission system
6. WebSocket integration for real-time plugin operations

## ClaudeWS API Understanding

Based on claudews-docs/api-reference.md, ClaudeWS provides:

### Agent Factory Endpoints
- `GET /api/agent-factory/plugins?type={type}` - List plugins with optional type filter
- `GET /api/agent-factory/plugins/{id}` - Get plugin details
- `POST /api/agent-factory/plugins` - Create plugin
- `PUT /api/agent-factory/plugins/{id}` - Update plugin
- `DELETE /api/agent-factory/plugins/{id}` - Delete plugin
- `POST /api/agent-factory/discover` - Discover plugins from paths
- `POST /api/agent-factory/compare` - Compare discovered vs existing
- `POST /api/agent-factory/import` - Import plugin
- `POST /api/agent-factory/upload` - Upload plugin (multipart/form-data)
- `GET /api/agent-factory/plugins/{id}/files` - List plugin files
- `GET /api/agent-factory/plugins/{id}/dependencies` - Get dependencies
- `POST /api/agent-factory/dependencies/{id}/install` - Install dependency

### Plugin Types
- `skill` - Reusable skills with SKILL.md
- `command` - Slash commands
- `agent` - AI agent configurations
- `agent_set` - Collections of plugins

### Authentication
All requests require `x-api-key` header when `API_ACCESS_KEY` is set.

## Architecture Design

### Database Schema

#### ClaudeWSServer Entity
```typescript
@Entity()
export class ClaudeWSServer {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column()
    description: string

    @Column()
    endpointUrl: string  // Base URL (e.g., http://localhost:33333)

    @Column({ type: 'text' })
    apiKey: string  // Encrypted API key

    @Column({ default: true })
    isActive: boolean

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @Column({ nullable: true, type: 'text' })
    workspaceId?: string

    @Column({ nullable: true, type: 'text' })
    roomId?: string  // NULL = shared by admin, else room-specific
}
```

#### ClaudeWSPlugin Entity (Cache/Metadata)
```typescript
@Entity()
export class ClaudeWSPlugin {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    serverId: string  // FK to ClaudeWSServer

    @Column()
    pluginId: string  // Plugin ID from ClaudeWS

    @Column()
    type: string  // skill | command | agent | agent_set

    @Column()
    name: string

    @Column({ type: 'text' })
    description: string

    @Column({ type: 'text', nullable: true })
    sourcePath?: string

    @Column({ type: 'text', nullable: true })
    metadata?: string  // JSON stringified metadata

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @ManyToOne(() => ClaudeWSServer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'serverId' })
    server: ClaudeWSServer
}
```

### Backend API Structure

#### Routes: `/api/v1/claudews-servers`

**Server Management**
- `GET /` - List all ClaudeWS servers (with room filtering)
- `POST /` - Create new server
- `GET /:id` - Get server details
- `PUT /:id` - Update server
- `DELETE /:id` - Delete server
- `POST /:id/test-connection` - Test server connectivity

**Plugin Management**
- `GET /:serverId/plugins?type={type}` - List plugins from server
- `GET /:serverId/plugins/:pluginId` - Get plugin details
- `POST /:serverId/plugins/discover` - Discover plugins
- `POST /:serverId/plugins/upload` - Upload plugin
- `POST /:serverId/plugins/import` - Import plugin
- `DELETE /:serverId/plugins/:pluginId` - Delete plugin
- `GET /:serverId/plugins/:pluginId/files` - List plugin files
- `GET /:serverId/plugins/:pluginId/dependencies` - Get dependencies
- `POST /:serverId/plugins/:pluginId/dependencies/:depId/install` - Install dependency

#### Service Layer

**ClaudeWSServerService**
```typescript
class ClaudeWSServerService {
    // CRUD operations
    async createServer(data, userId, workspaceId, roomId, isRootAdmin)
    async getAllServers(workspaceId, roomId, isRootAdmin, page, limit)
    async getServerById(id)
    async updateServer(id, data, userId, isRootAdmin)
    async deleteServer(id, userId, isRootAdmin)

    // Connection testing
    async testConnection(id)

    // Helper: Create HTTP client with API key
    private createClient(server): AxiosInstance
}
```

**ClaudeWSPluginService**
```typescript
class ClaudeWSPluginService {
    // Plugin operations
    async listPlugins(serverId, type?, userId, isRootAdmin)
    async getPlugin(serverId, pluginId, userId, isRootAdmin)
    async discoverPlugins(serverId, paths, userId, isRootAdmin)
    async uploadPlugin(serverId, files, userId, isRootAdmin)
    async importPlugin(serverId, data, userId, isRootAdmin)
    async deletePlugin(serverId, pluginId, userId, isRootAdmin)

    // Plugin files & dependencies
    async listPluginFiles(serverId, pluginId, userId, isRootAdmin)
    async getPluginDependencies(serverId, pluginId, userId, isRootAdmin)
    async installDependency(serverId, pluginId, depId, userId, isRootAdmin)

    // Cache management
    async syncPluginCache(serverId)
    async clearPluginCache(serverId)
}
```

#### Room Isolation Logic

Following PrivOS patterns (from packages/server/src/controllers/tools/index.ts):

```typescript
// In ClaudeWSServerController
const getAllServers = async (req: Request, res: Response) => {
    const { page, limit } = getPageAndLimitParams(req)
    const workspaceId = req.user?.activeWorkspaceId
    const roomId = req.roomId
    const isRootAdmin = req.isRootAdmin

    // Filter logic:
    // - Root admins: See all servers
    // - Room users: See (roomId = current OR roomId IS NULL)
    const apiResponse = await claudewsServerService.getAllServers(
        workspaceId, roomId, isRootAdmin, page, limit
    )
    return res.json(apiResponse)
}

const deleteServer = async (req: Request, res: Response) => {
    const server = await claudewsServerService.getServerById(req.params.id)

    // Prevent room users from deleting global resources
    if (!req.isRootAdmin && req.roomId && !server.roomId) {
        throw new InternalFlowiseError(
            StatusCodes.FORBIDDEN,
            'Cannot delete global resources'
        )
    }

    await claudewsServerService.deleteServer(req.params.id)
    return res.json({ success: true })
}
```

### Frontend Architecture

#### Menu Integration

**Location:** packages/ui/src/menu-items/dashboard.js

Add under "Tools" section:
```javascript
{
    id: 'tools',
    title: 'Tools',
    type: 'item',
    url: '/tools',
    icon: icons.IconTool,
    breadcrumbs: true,
    permission: 'tools:view',
    children: [  // NEW: Add nested menu
        {
            id: 'claudews-settings',
            title: 'ClaudeWS Settings',
            type: 'item',
            url: '/tools/claudews',
            icon: icons.IconServer,
            breadcrumbs: true,
            permission: 'tools:view'  // Always visible if tools:view granted
        }
    ]
}
```

#### Component Structure

**Directory:** packages/ui/src/views/claudews/

```
claudews/
├── index.jsx                    // Main ClaudeWS Settings page
├── ServerList.jsx               // Server list with room/global badges
├── ServerDialog.jsx             // Create/Edit server form
├── PluginManager.jsx            // Plugin management for selected server
├── PluginList.jsx               // Filterable plugin list
├── PluginCard.jsx               // Individual plugin card
├── PluginUploadDialog.jsx       // Upload plugin dialog
├── PluginDiscoveryDialog.jsx    // Discover plugins dialog
├── PluginDetailsDialog.jsx      // Plugin details with files/deps
├── DependencyInstaller.jsx      // Dependency management
└── ConnectionTester.jsx         // Test server connection
```

#### Main Page Layout

```jsx
// packages/ui/src/views/claudews/index.jsx
import { useState, useEffect } from 'react'
import MainCard from 'ui-component/cards/MainCard'
import ServerList from './ServerList'
import PluginManager from './PluginManager'

const ClaudeWSSettings = () => {
    const [servers, setServers] = useState([])
    const [selectedServer, setSelectedServer] = useState(null)
    const [loading, setLoading] = useState(false)

    // Left: Server list
    // Right: Plugin manager (when server selected)
    return (
        <MainCard>
            <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                    <ServerList
                        servers={servers}
                        selectedServer={selectedServer}
                        onSelect={setSelectedServer}
                        onRefresh={loadServers}
                    />
                </Grid>
                <Grid item xs={12} md={8}>
                    {selectedServer && (
                        <PluginManager
                            server={selectedServer}
                        />
                    )}
                </Grid>
            </Grid>
        </MainCard>
    )
}
```

#### Server List Component

```jsx
// ServerList.jsx
- Display servers in cards/list
- Show room/global badges
- Create/Edit/Delete buttons
- Connection status indicator
- Select server to view plugins
```

#### Plugin Manager Component

```jsx
// PluginManager.jsx
- Tab filters: All | Skills | Agents | Commands | Agent Sets
- Search/filter bar
- Action buttons: Upload | Discover | Refresh
- Plugin grid/list view
- Each plugin shows:
  - Name, type, description
  - View Details | Remove buttons
  - Dependency status
```

### RBAC Permissions

Add to permission system:
```typescript
'claudews:view'        // View ClaudeWS servers
'claudews:create'      // Create servers
'claudews:update'      // Edit servers
'claudews:delete'      // Delete servers
'claudews:plugins'     // Manage plugins
'claudews:share'       // Share servers globally (admin only)
```

Map to existing "tools:*" permissions or create dedicated ones.

## Implementation Phases

### Phase 1: Database & Backend Foundation
**Duration:** 2-3 days
**Files:**
- `packages/server/src/database/entities/ClaudeWSServer.ts`
- `packages/server/src/database/entities/ClaudeWSPlugin.ts`
- `packages/server/src/database/migrations/{db}/AddClaudeWSEntities.ts`
- `packages/server/src/Interface.ts` (add interfaces)
- `packages/server/src/services/claudews-servers/index.ts`
- `packages/server/src/services/claudews-plugins/index.ts`

**Tasks:**
1. Create entity classes
2. Create migrations for all DB types (SQLite, MySQL, PostgreSQL, MariaDB)
3. Create service layer with room isolation logic
4. Create HTTP client factory with API key headers
5. Add connection testing logic
6. Write unit tests

**Validation:**
- Run migrations successfully
- Test service layer with mock data
- Verify room isolation filtering

### Phase 2: Backend API Endpoints
**Duration:** 2-3 days
**Files:**
- `packages/server/src/controllers/claudews-servers/index.ts`
- `packages/server/src/controllers/claudews-plugins/index.ts`
- `packages/server/src/routes/claudews-servers/index.ts`
- `packages/server/src/routes/index.ts` (register routes)

**Tasks:**
1. Create controller methods with room isolation checks
2. Create route definitions with RBAC middleware
3. Add request validation
4. Add error handling
5. Test endpoints with Postman/Thunder Client

**Validation:**
- All CRUD operations work
- Room isolation enforced
- API key encryption/decryption works
- Error responses follow PrivOS patterns

### Phase 3: Frontend UI Components
**Duration:** 3-4 days
**Files:**
- `packages/ui/src/views/claudews/index.jsx`
- `packages/ui/src/views/claudews/ServerList.jsx`
- `packages/ui/src/views/claudews/ServerDialog.jsx`
- `packages/ui/src/views/claudews/PluginManager.jsx`
- `packages/ui/src/views/claudews/PluginList.jsx`
- `packages/ui/src/views/claudews/PluginCard.jsx`
- `packages/ui/src/views/claudews/PluginUploadDialog.jsx`
- `packages/ui/src/views/claudews/PluginDiscoveryDialog.jsx`
- `packages/ui/src/views/claudews/PluginDetailsDialog.jsx`
- `packages/ui/src/api/claudews.js` (API client)

**Tasks:**
1. Create base layout and navigation
2. Build server management UI
3. Build plugin management UI
4. Add filtering and search
5. Add upload/discovery dialogs
6. Add connection testing UI
7. Style components to match PrivOS design system

**Validation:**
- UI matches existing PrivOS components
- All interactions work smoothly
- Loading states and error handling
- Responsive design

### Phase 4: Menu Integration & Navigation
**Duration:** 1 day
**Files:**
- `packages/ui/src/menu-items/dashboard.js`
- `packages/ui/src/routes/MainRoutes.js`

**Tasks:**
1. Add nested menu item under Tools
2. Register route for /tools/claudews
3. Add appropriate icons
4. Test navigation flow

**Validation:**
- Menu appears correctly
- Navigation works
- Breadcrumbs correct
- Permissions respected

### Phase 5: Testing & Refinement
**Duration:** 2 days
**Files:**
- All created files
- Test files

**Tasks:**
1. End-to-end testing
2. Room isolation testing
3. Error scenario testing
4. Performance testing
5. Bug fixes
6. Documentation

**Validation:**
- All features work as expected
- No security vulnerabilities
- Performance acceptable
- Documentation complete

## Security Considerations

### API Key Storage
- Encrypt API keys in database (use PrivOS encryption utilities)
- Never return API keys in GET responses (mask/redact)
- Only show full API key during creation

### Room Isolation
- Enforce server-side filtering in all queries
- Prevent room users from:
  - Viewing servers outside their room (except global)
  - Editing/deleting global servers
  - Sharing servers globally
- Allow admins to share servers (set roomId = NULL)

### Input Validation
- Validate endpoint URLs (must be valid HTTP/HTTPS)
- Sanitize all inputs
- Prevent path traversal in plugin uploads
- Validate file types for uploads

### Rate Limiting
- Add rate limiting to ClaudeWS proxy endpoints
- Prevent abuse of discovery/upload operations

## Error Handling Patterns

Follow PrivOS patterns:
```typescript
// Service layer
if (!server) {
    throw new InternalFlowiseError(
        StatusCodes.NOT_FOUND,
        `ClaudeWS server ${id} not found`
    )
}

// Controller layer
try {
    const result = await service.operation()
    return res.json(result)
} catch (error) {
    next(error)  // Pass to error middleware
}
```

## Testing Strategy

### Unit Tests
- Service layer methods
- Room isolation logic
- Encryption/decryption
- HTTP client creation

### Integration Tests
- API endpoints
- Database operations
- ClaudeWS API integration

### E2E Tests
- Full user workflows
- Room isolation scenarios
- Plugin upload/discovery

## Performance Optimizations

### Caching
- Cache plugin lists (5-minute TTL)
- Cache server connection status
- Invalidate on updates

### Pagination
- Paginate server lists
- Paginate plugin lists
- Use existing pagination utilities

### Lazy Loading
- Load plugins only when server selected
- Load plugin details on demand

## Documentation Requirements

### User Documentation
- How to add ClaudeWS server
- How to manage plugins
- Understanding room vs global servers
- Troubleshooting connection issues

### Developer Documentation
- API endpoint documentation
- Database schema
- Room isolation implementation
- Adding new plugin types

## Migration Strategy

### Database Migrations
Create migrations for all supported databases:
- SQLite
- MySQL
- PostgreSQL
- MariaDB

Follow naming convention: `{timestamp}-AddClaudeWSEntities.ts`

### Backward Compatibility
- New feature, no breaking changes
- Existing functionality unaffected
- Optional feature (can be disabled if needed)

## Rollback Plan

### If Issues Occur
1. Disable ClaudeWS menu item
2. Revert database migrations
3. Remove API routes
4. Deploy previous version

### Data Preservation
- Export ClaudeWS configs before rollback
- Provide import script for recovery

## Success Criteria

### Functional
- ✅ Users can add/edit/delete ClaudeWS servers
- ✅ Room isolation works correctly
- ✅ Admin can share servers globally
- ✅ Plugin management fully functional
- ✅ Discovery and filtering work
- ✅ Upload functionality works
- ✅ Connection testing works

### Non-Functional
- ✅ Performance acceptable (<2s page load)
- ✅ UI matches PrivOS design system
- ✅ No security vulnerabilities
- ✅ All tests passing
- ✅ Documentation complete

## Open Questions

1. **Plugin Sync**: Should we auto-sync plugins periodically or on-demand only?
2. **WebSocket Integration**: Do we need real-time updates for plugin operations?
3. **Multi-Server**: Can multiple servers be managed simultaneously or one at a time?
4. **Backup/Export**: Should we provide export/import for server configs?
5. **Metrics**: Should we track plugin usage/installation metrics?

## Dependencies

### External
- ClaudeWS server running and accessible
- Network connectivity to ClaudeWS endpoints

### Internal
- TypeORM
- Express
- React
- Material-UI
- Existing PrivOS utilities (encryption, pagination, RBAC)

## Timeline Estimate

**Total Duration:** 10-13 days

- Phase 1: 2-3 days
- Phase 2: 2-3 days
- Phase 3: 3-4 days
- Phase 4: 1 day
- Phase 5: 2 days

**Buffer:** +3 days for unexpected issues

**Total:** ~16 days (3.2 weeks)

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Create feature branch: `feature/claudews-integration`
4. Begin Phase 1 implementation
5. Schedule daily standups for progress tracking

---

**Plan Created:** 2026-01-18
**Plan Owner:** Development Team
**Reviewers:** Tech Lead, Product Owner
