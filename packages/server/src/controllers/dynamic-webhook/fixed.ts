import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import logger from '../../utils/logger'
import PrivosBoardService from '../../services/privosBoardService'

/**
 * FIXED WEBHOOK HANDLER
 *
 * This is a SINGLE, SHARED webhook endpoint that multiple users can use
 * without creating individual webhooks.
 *
 * URL: /webhook-lp/fixed
 *
 * Users specify target URL in request body or query parameter
 */

/**
 * Handle fixed webhook endpoint
 * POST /webhook-lp/fixed
 *
 * Request body can include:
 * - targetUrl: Where to forward the data (required)
 * - apiKey: API key for target service (optional)
 * - data: The actual data to forward (required)
 *
 * Example:
 * POST /webhook-lp/fixed
 * {
 *   "targetUrl": "https://crm.example.com/api/leads",
 *   "apiKey": "crm_api_key_123",
 *   "data": {
 *     "email": "customer@example.com",
 *     "phone": "+84901234567",
 *     "name": "John Doe"
 *   }
 * }
 */
export const handleFixedWebhook = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = uuidv4()

    try {
        // DEBUG: Log incoming request
        logger.info(`[fixed-webhook]: ===== RECEIVED REQUEST =====`)
        logger.info(`[fixed-webhook]: Method: ${req.method}`)
        logger.info(`[fixed-webhook]: URL: ${req.url}`)
        logger.info(`[fixed-webhook]: Body: ${JSON.stringify(req.body)}`)
        logger.info(`[fixed-webhook]: Query: ${JSON.stringify(req.query)}`)

        // Extract target URL from body, query, or header
        let targetUrl = req.body.targetUrl || req.query.targetUrl || (req.headers['x-target-url'] as string)

        // Extract API key from body, query, or header
        const targetApiKey = req.body.apiKey || req.query.apiKey || (req.headers['x-target-api-key'] as string)

        // Extract the actual data to forward
        const data = req.body.data || req.body

        logger.info(`[fixed-webhook]: Extracted targetUrl: ${targetUrl}`)
        logger.info(`[fixed-webhook]: Extracted apiKey: ${targetApiKey ? '***' + targetApiKey.slice(-4) : 'none'}`)
        logger.info(`[fixed-webhook]: Extracted data: ${JSON.stringify(data)}`)

        if (!targetUrl) {
            logger.warn(`[fixed-webhook]: Missing targetUrl`)
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Missing targetUrl. Provide targetUrl in body, query, or header.',
                usage: {
                    method: 'POST /webhook-lp/privos-ai',
                    body: {
                        targetUrl: 'https://your-crm.com/api/leads',
                        apiKey: 'your-crm-api-key',
                        data: {
                            email: 'customer@example.com',
                            phone: '+84901234567',
                            name: 'Customer Name'
                        }
                    }
                }
            })
        }

        // Validate URL
        try {
            new URL(targetUrl)
        } catch (error) {
            logger.error(`[fixed-webhook]: Invalid URL: ${targetUrl}`)
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Invalid targetUrl format'
            })
        }

        logger.info(`[fixed-webhook]: Processing fixed webhook (requestId: ${requestId}, targetUrl: ${targetUrl})`)

        // Prepare headers for target request
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }

        if (targetApiKey) {
            headers['Authorization'] = `Bearer ${targetApiKey}`
        }

        logger.info(`[fixed-webhook]: Forwarding to ${targetUrl}...`)

        // Forward to target
        const response = await axios({
            method: 'POST',
            url: targetUrl,
            headers,
            data,
            timeout: 30000
        })

        const processingTime = Date.now() - startTime

        logger.info(
            `[fixed-webhook]: ✅ Successfully forwarded to ${targetUrl} (requestId: ${requestId}, status: ${response.status}, time: ${processingTime}ms)`
        )

        return res.json({
            success: true,
            messageId: requestId,
            forwarded: true,
            targetUrl: targetUrl,
            httpStatus: response.status,
            processingTime,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        const processingTime = Date.now() - startTime

        logger.error(`[fixed-webhook]: Failed to forward (requestId: ${requestId}): ${error.message}`)
        logger.error(
            `[fixed-webhook]: Error details: ${JSON.stringify({
                message: error.message,
                code: error.code,
                response: error.response?.data,
                status: error.response?.status
            })}`
        )

        // Return error response
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            messageId: requestId,
            error: error.message,
            processingTime,
            timestamp: new Date().toISOString(),
            details: error.response?.data || null,
            debug: {
                targetUrl: req.body?.targetUrl || req.query?.targetUrl,
                hasData: !!req.body?.data || !!req.body
            }
        })
    }
}

/**
 * PRIVOS BOARD WEBHOOK HANDLER
 *
 * Creates items directly in Privos Board from webhook payload
 * POST /webhook-lp/privos-board
 *
 * Expected payload:
 * {
 *   // User input
 *   name: "...",
 *   email: "...",
 *   phone_number: "...",
 *   message: "...",
 *   source: "...",
 *
 *   // Routing info
 *   roomId: "...",
 *   listId: "...",
 *   stageId: "...",
 *
 *   // Custom field IDs
 *   customFieldIds: {
 *     email: "EMAIL_FIELD_ID",
 *     phone: "PHONE_FIELD_ID",
 *     name: "NAME_FIELD_ID",
 *     message: "MESSAGE_FIELD_ID",
 *     source: "SOURCE_FIELD_ID"
 *   }
 * }
 */
export const handlePrivosBoardWebhook = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = uuidv4()

    try {
        logger.info(`[privos-board-webhook]: ===== RECEIVED REQUEST =====`)
        logger.info(`[privos-board-webhook]: Method: ${req.method}`)
        logger.info(`[privos-board-webhook]: URL: ${req.url}`)
        logger.info(`[privos-board-webhook]: Body: ${JSON.stringify(req.body)}`)

        const payload = req.body

        // Validate required fields
        if (!payload.listId || !payload.stageId) {
            logger.warn(`[privos-board-webhook]: Missing required fields`)
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Missing required fields: listId and stageId are required',
                usage: {
                    method: 'POST /webhook-lp/privos-board',
                    body: {
                        name: 'John Doe',
                        email: 'john@example.com',
                        phone_number: '+84901234567',
                        message: 'Interested in your services',
                        source: 'landing-page',
                        roomId: 'YOUR_ROOM_ID',
                        listId: 'YOUR_LIST_ID',
                        stageId: 'YOUR_STAGE_ID',
                        customFieldIds: {
                            email: 'field_email_123',
                            phone: 'field_phone_456',
                            name: 'field_name_789',
                            message: 'field_message_012',
                            source: 'field_source_345'
                        }
                    }
                }
            })
        }

        // Get API key from payload or server environment
        // Priority: payload.privosApiKey > server env (PRIVOS_CHAT_API_KEY)
        const apiKey = payload.privosApiKey || process.env.PRIVOS_CHAT_API_KEY || ''
        const baseUrl = process.env.PRIVOS_CHAT_URL || process.env.PRIVOS_API_BASE_URL || 'https://privos.roxane.one/api/v1'

        if (!apiKey) {
            logger.error(`[privos-board-webhook]: Missing Privos API key (check PRIVOS_CHAT_API_KEY in server .env)`)
            return res.status(StatusCodes.UNAUTHORIZED).json({
                success: false,
                error: 'Unauthorized: Privos API key not configured on server. Contact administrator.',
                debug: {
                    hasPrivosApiKeyInPayload: !!payload.privosApiKey,
                    hasEnvKey: !!process.env.PRIVOS_CHAT_API_KEY,
                    envKeyName: 'PRIVOS_CHAT_API_KEY'
                }
            })
        }

        logger.info(`[privos-board-webhook]: Processing Privos Board webhook (requestId: ${requestId})`)
        logger.info(`[privos-board-webhook]: List ID: ${payload.listId}`)
        logger.info(`[privos-board-webhook]: Stage ID: ${payload.stageId}`)
        logger.info(`[privos-board-webhook]: Base URL: ${baseUrl}`)
        logger.info(`[privos-board-webhook]: Has API Key: Yes (${apiKey.slice(0, 8)}...)`)

        // Initialize Privos Board Service with API key
        const privosService = new PrivosBoardService(apiKey, '', baseUrl)

        // Map payload to item request
        const itemRequest = PrivosBoardService.mapWebhookPayloadToItemRequest(payload)

        logger.info(`[privos-board-webhook]: Mapped item request: ${JSON.stringify(itemRequest)}`)

        // Create item in Privos Board
        const result = await privosService.createItem(itemRequest)

        const processingTime = Date.now() - startTime

        if (result.success) {
            logger.info(
                `[privos-board-webhook]: ✅ Item created successfully (requestId: ${requestId}, itemId: ${result.data?._id}, time: ${processingTime}ms)`
            )

            return res.json({
                success: true,
                itemId: result.data?._id,
                itemName: result.data?.name,
                message: 'Item created successfully in Privos board',
                inputData: {
                    name: payload.name,
                    email: payload.email,
                    phone_number: payload.phone_number,
                    listId: payload.listId,
                    stageId: payload.stageId
                },
                processingTime,
                timestamp: new Date().toISOString()
            })
        } else {
            logger.error(`[privos-board-webhook]: ❌ Failed to create item (requestId: ${requestId}): ${result.message}`)

            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: result.message || 'Failed to create item in Privos board',
                details: result.error,
                processingTime,
                timestamp: new Date().toISOString()
            })
        }
    } catch (error: any) {
        const processingTime = Date.now() - startTime

        logger.error(`[privos-board-webhook]: ❌ Error processing webhook (requestId: ${requestId}): ${error.message}`)
        logger.error(
            `[privos-board-webhook]: Error details: ${JSON.stringify({
                message: error.message,
                code: error.code,
                stack: error.stack
            })}`
        )

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            processingTime,
            timestamp: new Date().toISOString()
        })
    }
}

/**
 * Handle fixed webhook with GET method (for testing)
 * GET /webhook-lp/fixed?targetUrl=...&email=...&phone=...
 */
export const handleFixedWebhookGet = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = uuidv4()

    try {
        const targetUrl = req.query.targetUrl as string
        const targetApiKey = req.query.apiKey as string

        if (!targetUrl) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Missing targetUrl query parameter',
                usage: 'GET /webhook-lp/fixed?targetUrl=https://crm.com/api/leads&email=test@example.com&phone=123456'
            })
        }

        // Extract data from query parameters
        const data: Record<string, any> = {}
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'targetUrl' && key !== 'apiKey') {
                data[key] = value
            }
        }

        // Validate URL
        try {
            new URL(targetUrl)
        } catch (error) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Invalid targetUrl format'
            })
        }

        logger.info(`[fixed-webhook]: Processing fixed webhook GET (requestId: ${requestId})`)

        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }

        if (targetApiKey) {
            headers['Authorization'] = `Bearer ${targetApiKey}`
        }

        // Forward to target
        const response = await axios({
            method: 'POST',
            url: targetUrl,
            headers,
            data,
            timeout: 30000
        })

        const processingTime = Date.now() - startTime

        return res.json({
            success: true,
            messageId: requestId,
            forwarded: true,
            targetUrl: targetUrl,
            httpStatus: response.status,
            processingTime,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        const processingTime = Date.now() - startTime

        logger.error(`[fixed-webhook]: Failed to forward GET (requestId: ${requestId}): ${error.message}`)

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            messageId: requestId,
            error: error.message,
            processingTime,
            timestamp: new Date().toISOString()
        })
    }
}
