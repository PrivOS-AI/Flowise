import express from 'express'
import claudewsServerController from '../../controllers/claudews-servers'
import claudewsPluginController from '../../controllers/claudews-plugins'
import { checkPermission } from '../../enterprise/rbac/PermissionCheck'
import { getMulterStorage } from '../../utils'

const router = express.Router()

// Server Management
router.post('/', checkPermission('tools:create'), claudewsServerController.createServer)
router.get('/', checkPermission('tools:view'), claudewsServerController.getAllServers)
router.get('/:id', checkPermission('tools:view'), claudewsServerController.getServerById)
router.put('/:id', checkPermission('tools:update'), claudewsServerController.updateServer)
router.delete('/:id', checkPermission('tools:delete'), claudewsServerController.deleteServer)
router.post('/:id/test-connection', checkPermission('tools:view'), claudewsServerController.testConnection)
router.post('/test-connection', checkPermission('tools:view'), claudewsServerController.testConnectionWithCredentials)

// Plugin Management
router.get('/:serverId/plugins', checkPermission('tools:view'), claudewsPluginController.listPlugins)
router.get('/:serverId/plugins/:pluginId', checkPermission('tools:view'), claudewsPluginController.getPlugin)
router.post('/:serverId/plugins/discover', checkPermission('tools:create'), claudewsPluginController.discoverPlugins)
router.post('/:serverId/plugins/upload', checkPermission('tools:create'), getMulterStorage().array('file'), claudewsPluginController.uploadPlugin)
router.post('/:serverId/plugins/import', checkPermission('tools:create'), claudewsPluginController.importPlugin)
router.delete('/:serverId/plugins/:pluginId', checkPermission('tools:delete'), claudewsPluginController.deletePlugin)
router.get('/:serverId/plugins/:pluginId/files', checkPermission('tools:view'), claudewsPluginController.listPluginFiles)
router.get('/:serverId/plugins/:pluginId/files/*', checkPermission('tools:view'), claudewsPluginController.getPluginFileContent)
router.get('/:serverId/plugins/:pluginId/dependencies', checkPermission('tools:view'), claudewsPluginController.getPluginDependencies)
router.post(
    '/:serverId/plugins/:pluginId/dependencies/:depId/install',
    checkPermission('tools:create'),
    claudewsPluginController.installDependency
)

// File content from absolute path (for discovered plugins)
router.post('/:serverId/file-content', checkPermission('tools:view'), claudewsPluginController.getFileContent)

// List files from source path (for discovered plugins)
router.post('/:serverId/files-from-source', checkPermission('tools:view'), claudewsPluginController.listFilesFromSource)

// Get dependencies from source path (for discovered plugins)
router.post('/:serverId/dependencies-from-source', checkPermission('tools:view'), claudewsPluginController.getDependenciesFromSource)

export default router
