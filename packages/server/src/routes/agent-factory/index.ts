import express from 'express'
import agentFactoryController from '../../controllers/agent-factory'

const router = express.Router()

router.post('/plugins/import', agentFactoryController.importPlugin)
router.get('/plugins', agentFactoryController.listPlugins)
router.post('/discover', agentFactoryController.discoverPlugins)
router.post('/upload', agentFactoryController.uploadPlugin)
router.get('/plugins/:id', agentFactoryController.getPlugin)
router.delete('/plugins/:id', agentFactoryController.deletePlugin)
router.post('/file-content', agentFactoryController.getFileContent)
router.post('/files/list', agentFactoryController.listFiles)
router.post('/dependencies', agentFactoryController.getDependencies)

export default router
