import express from 'express'
import * as publicWebhookController from '../../controllers/dynamic-webhook/public'

const router = express.Router()

/**
 * Public Webhook API Routes (NO AUTHENTICATION REQUIRED)
 * Base path: /api/v1/public/webhooks
 *
 * These endpoints allow external services to create and manage webhooks
 * WITHOUT requiring Flowise authentication.
 *
 * Use cases:
 * - Public API for integrations
 * - Third-party services
 * - Quick webhook creation without login
 */

/**
 * Create a new webhook (public)
 * POST /api/v1/public/webhooks/create
 *
 * No authentication required
 * Anyone can create a webhook
 */
router.post('/create', publicWebhookController.createPublicWebhook)

/**
 * Get webhook details (public)
 * GET /api/v1/public/webhooks/:webhookId
 *
 * Requires webhook's API key in header or query parameter
 */
router.get('/:webhookId', publicWebhookController.getPublicWebhook)

export default router
