import express from 'express'
import webhookTriggersController from '../../controllers/webhook-triggers'

const router = express.Router()

router.post('/', webhookTriggersController.handleWebhookEvent)
router.post('/:slug', webhookTriggersController.handleWebhookEventBySlug)

export default router
