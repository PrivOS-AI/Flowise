import express from 'express'
import agentflowFoldersController from '../../controllers/agentflow-folders'
import { checkAnyPermission, checkPermission } from '../../enterprise/rbac/PermissionCheck'

const router = express.Router()

// CREATE
router.post('/', checkPermission('chatflows:create'), agentflowFoldersController.createFolder)

// READ
router.get('/', checkAnyPermission('chatflows:view,chatflows:update'), agentflowFoldersController.getAllFolders)
router.get('/:id', checkAnyPermission('chatflows:view,chatflows:update'), agentflowFoldersController.getFolderById)

// UPDATE
router.put('/:id', checkPermission('chatflows:update'), agentflowFoldersController.updateFolder)

// DELETE
router.delete('/:id', checkPermission('chatflows:delete'), agentflowFoldersController.deleteFolder)

export default router
