# Hot Reload Fix - Quick Start

## Fixed Issues ✅
- ✅ UI (Vite) now hot-reloads instantly without full page refresh
- ✅ Backend (Nodemon) auto-restarts on file changes using ts-node
- ✅ Components package has watch mode for auto-rebuild

## How to Test

1. **Stop any running dev servers** (Ctrl+C or `pkill -f turbo`)

2. **Start development**:
   ```bash
   cd /home/roxane/projects/privos-studio
   pnpm run dev
   ```

3. **Test UI hot reload**:
   - Open http://localhost:10001
   - Edit any file in `packages/ui/src/`
   - Changes appear instantly!

4. **Test backend reload**:
   - Edit any file in `packages/server/src/`
   - Server restarts automatically in 1-2 seconds

5. **Test components**:
   - Edit any file in `packages/components/`
   - Auto-recompiles with `tsc --watch`

## What Changed

### UI (`packages/ui/vite.config.js`)
- Added efficient file watching with proper ignore patterns
- Fixed HMR WebSocket to use `localhost` instead of `0.0.0.0`
- Optimized dependencies for monorepo workspace

### Backend (`packages/server/nodemon.json`)
- Uses `ts-node` directly instead of `pnpm start` (faster)
- Focused watch on `src/` directory only
- Added delay to prevent crash loops

### Components (`packages/components/package.json`)
- Added `dev` and `dev:watch` scripts
- Runs `tsc --watch` for automatic compilation

## Troubleshooting

### UI changes don't appear:
```bash
rm -rf packages/ui/node_modules/.vite
pnpm run dev
```

### Backend doesn't restart:
- Check for TypeScript syntax errors
- Verify ts-node works: `cd packages/server && npx ts-node --version`

### Still slow?
- Reduce `depth` in vite.config.js (line 58)
- Increase `delay` in nodemon.json (line 9)

## Expected Performance
- UI changes: **< 1 second** (instant hot reload)
- Backend changes: **1-2 seconds** (auto-restart)
- Components changes: **1-3 seconds** (auto-recompile)

No more manual `pnpm run dev` restarts! 🎉
