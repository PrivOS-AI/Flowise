import express from 'express'
import * as dynamicWebhookHandler from '../../controllers/dynamic-webhook/handler'
import * as fixedWebhookHandler from '../../controllers/dynamic-webhook/fixed'

const router = express.Router()

/**
 * PRIVOS.AI FIXED WEBHOOK ENDPOINT (Shared for all users)
 * POST /webhook-lp/privos-ai
 *
 * This is a SINGLE, SHARED webhook that anyone can use
 * without creating individual webhooks.
 *
 * Users specify target URL in request body or query parameter
 *
 * Example:
 * POST /webhook-lp/privos-ai
 * {
 *   "targetUrl": "https://crm.example.com/api/leads",
 *   "apiKey": "crm_api_key",
 *   "data": { "email": "test@example.com", "phone": "123456" }
 * }
 */
router.post('/privos-ai', fixedWebhookHandler.handleFixedWebhook)

/**
 * PRIVOS.AI FIXED WEBHOOK (GET method for testing)
 * GET /webhook-lp/privos-ai?targetUrl=...&email=...&phone=...
 */
router.get('/privos-ai', fixedWebhookHandler.handleFixedWebhookGet)

/**
 * PRIVOS BOARD WEBHOOK ENDPOINT
 * POST /webhook-lp/privos-board
 *
 * Creates items directly in Privos Board from webhook payload
 *
 * Example:
 * POST /webhook-lp/privos-board
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "phone_number": "+84901234567",
 *   "message": "Interested in your services",
 *   "source": "landing-page",
 *   "roomId": "YOUR_ROOM_ID",
 *   "listId": "YOUR_LIST_ID",
 *   "stageId": "YOUR_STAGE_ID",
 *   "customFieldIds": {
 *     "email": "field_email_123",
 *     "phone": "field_phone_456",
 *     "name": "field_name_789"
 *   }
 * }
 */
router.post('/privos-board', fixedWebhookHandler.handlePrivosBoardWebhook)

/**
 * DYNAMIC WEBHOOK ENDPOINTS (Individual webhooks)
 * POST /webhook-lp/:webhookId
 *
 * These are unique webhooks created by users
 * Example: https://flowise.privos.ai/webhook-lp/wh_abc123xyz
 */
router.post('/:webhookId', dynamicWebhookHandler.handleIncomingWebhook)

/**
 * OPTIONS for CORS preflight
 * OPTIONS /webhook-lp/:webhookId
 */
router.options('/:webhookId', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization')
    res.sendStatus(200)
})

export default router
