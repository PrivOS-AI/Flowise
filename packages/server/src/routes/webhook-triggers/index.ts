import express from 'express'
import webhookTriggersController from '../../controllers/webhook-triggers'

const router = express.Router()

router.post('/events', webhookTriggersController.handleWebhookEvent)

export default router
