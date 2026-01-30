import express from 'express'
import agentflowv3GeneratorController from '../../controllers/agentflowv3-generator'
const router = express.Router()

router.get('/prompt', agentflowv3GeneratorController.getV3Prompt)
router.post('/validate', agentflowv3GeneratorController.validateFlow)

export default router
