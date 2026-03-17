import express from 'express'
import * as dynamicWebhookController from '../../controllers/dynamic-webhook'

const router = express.Router()

/**
 * Webhook Management API Routes (require authentication)
 * All routes: /api/v1/webhooks
 */

/**
 * Create a new webhook
 * POST /api/v1/webhooks
 */
router.post('/', dynamicWebhookController.createWebhook)

/**
 * List all webhooks for current user
 * GET /api/v1/webhooks
 */
router.get('/', dynamicWebhookController.listWebhooks)

/**
 * Get webhook details
 * GET /api/v1/webhooks/:webhookId
 */
router.get('/:webhookId', dynamicWebhookController.getWebhook)

/**
 * Update webhook
 * PATCH /api/v1/webhooks/:webhookId
 */
router.patch('/:webhookId', dynamicWebhookController.updateWebhook)

/**
 * Delete webhook (soft delete)
 * DELETE /api/v1/webhooks/:webhookId
 */
router.delete('/:webhookId', dynamicWebhookController.deleteWebhook)

/**
 * Get webhook logs
 * GET /api/v1/webhooks/:webhookId/logs
 */
router.get('/:webhookId/logs', dynamicWebhookController.getWebhookLogs)

/**
 * Get webhook statistics
 * GET /api/v1/webhooks/:webhookId/stats
 */
router.get('/:webhookId/stats', dynamicWebhookController.getWebhookStats)

/**
 * Test webhook with sample data
 * POST /api/v1/webhooks/:webhookId/test
 */
router.post('/:webhookId/test', dynamicWebhookController.testWebhook)

export default router
