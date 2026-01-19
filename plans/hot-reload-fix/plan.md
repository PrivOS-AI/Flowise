# Hot Reload Fix Plan

## Problem Analysis

The project has multiple hot reload issues:
- **UI (Vite)**: Changes don't appear, full page reload happens instead of HMR
- **Backend (Nodemon)**: Server doesn't auto-restart on changes
- **Components**: No watch mode, manual rebuild required

## Root Causes

### 1. Vite Configuration Issues
- Missing `server.watch` configuration for efficient file watching
- No explicit watch settings for monorepo setup
- Potentially watching too many files (node_modules)
- HMR WebSocket configuration may not work correctly with `0.0.0.0` host

### 2. Nodemon Configuration Issues
- `exec: "pnpm start"` causes process chain issues
- Should run compiled JS directly, not restart through pnpm
- Missing TypeScript compilation step in watch mode

### 3. Components Package Missing Watch
- No `dev:watch` or similar script
- Changes require manual `pnpm run build`

## Solutions

### Phase 1: Fix Vite Hot Module Replacement (UI Package)

**File**: `packages/ui/vite.config.js`

Changes:
1. Add explicit `server.watch` config to ignore large directories
2. Configure HMR to work properly with network access
3. Add `optimizeDeps` configuration for workspace packages
4. Set up proper file watching for monorepo

```javascript
server: {
    watch: {
        ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
            '**/build/**'
        ],
        usePolling: false, // Disable polling on Linux/WSL
        depth: 10 // Limit directory traversal depth
    },
    hmr: {
        protocol: 'ws',
        host: 'localhost', // Override for HMR WebSocket
        port: 24678, // Default HMR port
        clientPort: 24678,
        overlay: true
    }
}
```

### Phase 2: Fix Nodemon Watch (Server Package)

**File**: `packages/server/nodemon.json`

Changes:
1. Use `ts-node` or watch mode with direct execution
2. Add proper ignore patterns
3. Watch compiled JS instead of restarting pnpm

**Option A (Better)**: Use `ts-node` for instant reload
```json
{
    "watch": ["src"],
    "ignore": ["src/**/*.spec.ts", ".git", "node_modules", "dist"],
    "ext": "ts,json",
    "exec": "ts-node --project tsconfig.json src/index.ts",
    "env": {
        "NODE_ENV": "development"
    }
}
```

**Option B (Faster)**: Compile in background with watch
```json
{
    "watch": ["dist"],
    "ignore": ["src", ".git", "node_modules"],
    "ext": "js",
    "exec": "node dist/index.js",
    "delay": "1000"
}
```

Then add separate watch script:
```json
"dev:watch": "tsc --watch"
```

### Phase 3: Add Components Watch Mode

**File**: `packages/components/package.json`

Add watch script:
```json
"dev:watch": "tsc --watch & gulp watch",
"watch": "tsc --watch"
```

### Phase 4: Update Root Dev Script

**File**: `package.json` (root)

Consider using `concurrently` for better parallel execution:
```json
"dev": "concurrently \"pnpm:dev:ui\" \"pnpm:dev:server\" \"pnpm:dev:components\" --names UI,API,LIB",
"dev:ui": "cd packages/ui && vite",
"dev:server": "cd packages/server && nodemon",
"dev:components": "cd packages/components && tsc --watch"
```

## Implementation Steps

1. ✏️ Update `packages/ui/vite.config.js` with proper watch and HMR config
2. ✏️ Update `packages/server/nodemon.json` to use ts-node directly
3. ✏️ Add watch script to `packages/components/package.json`
4. 🧪 Test UI hot reload by modifying a component
5. 🧪 Test backend reload by modifying a server file
6. 🧪 Test components rebuild by modifying a nodes file

## Expected Results

- UI changes appear instantly without full refresh
- Backend restarts within 1-2 seconds of file save
- Components rebuild automatically when changed
- No need to run `pnpm run dev` manually after changes
