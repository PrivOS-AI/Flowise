import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { DynamicWebhook, WebhookLog } from '../../entities/DynamicWebhook'
import axios from 'axios'
import logger from '../../utils/logger'

/**
 * Handle incoming webhook from external sources
 * POST /webhook-lp/:webhookId
 *
 * This is the PUBLIC endpoint that external services call
 */
export const handleIncomingWebhook = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = uuidv4()

    try {
        const { webhookId } = req.params
        const { AppDataSource } = getRunningExpressApp()

        // Log incoming request
        logger.info(`[dynamic-webhook]: Received webhook ${webhookId} (requestId: ${requestId})`)

        // Find webhook configuration
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)
        const webhook = await webhookRepo.findOne({
            where: { webhookId, isActive: true, isDeleted: false }
        })

        if (!webhook) {
            logger.warn(`[dynamic-webhook]: Webhook ${webhookId} not found or inactive`)
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: 'Webhook not found or inactive'
            })
        }

        // Check authentication if required
        if (webhook.requireAuth) {
            const apiKey = (req.headers['x-api-key'] as string) || (req.headers['authorization'] as string)

            if (!apiKey || apiKey !== webhook.apiKey) {
                logger.warn(`[dynamic-webhook]: Invalid API key for webhook ${webhookId}`)
                return res.status(StatusCodes.UNAUTHORIZED).json({
                    success: false,
                    error: 'Invalid or missing API key'
                })
            }
        }

        // Check CORS origin (if configured)
        if (webhook.allowedOrigins) {
            const origin = req.headers.origin
            const allowedOrigins = webhook.allowedOrigins.split(',').map((o) => o.trim())

            if (origin && !allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
                logger.warn(`[dynamic-webhook]: Origin ${origin} not allowed for webhook ${webhookId}`)
                // Don't block preflight requests
                if (req.method !== 'OPTIONS') {
                    return res.status(StatusCodes.FORBIDDEN).json({
                        success: false,
                        error: 'Origin not allowed'
                    })
                }
            }
        }

        // Create log entry
        const logRepo = AppDataSource.getRepository(WebhookLog)
        const logEntry = logRepo.create({
            id: uuidv4(),
            webhookId: webhook.webhookId,
            incomingPayload: req.body,
            status: 'received',
            sourceIp: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            requestId
        })

        // Process webhook
        let result: any

        try {
            // Transform payload
            let transformedPayload = req.body

            if (webhook.transformTemplate) {
                transformedPayload = applyTransformTemplate(req.body, webhook.transformTemplate)
            } else if (webhook.fieldMapping && Object.keys(webhook.fieldMapping).length > 0) {
                transformedPayload = applyFieldMapping(req.body, webhook.fieldMapping)
            }

            // Forward to third-party
            // Auto-inject Privos API key if target is Privos Board API and key is missing
            let requestHeaders = webhook.targetHeaders || {}

            // Check if target URL is Privos Board API and x-api-key is placeholder or missing
            const isPrivosBoardAPI =
                webhook.targetUrl?.includes('privos.roxane.one') && webhook.targetUrl?.includes('/internal/items.create')

            if (isPrivosBoardAPI) {
                const privosApiKey = process.env.PRIVOS_CHAT_API_KEY || process.env.PRIVOS_API_KEY

                if (privosApiKey) {
                    // Override or add x-api-key header
                    requestHeaders = {
                        ...requestHeaders,
                        'x-api-key': privosApiKey
                    }

                    logger.info(`[dynamic-webhook]: Auto-injected Privos API key for webhook ${webhookId}`)
                } else {
                    logger.warn(`[dynamic-webhook]: PRIVOS_CHAT_API_KEY not found in environment variables`)
                }
            }

            const response = await axios({
                method: webhook.targetMethod as any,
                url: webhook.targetUrl,
                headers: requestHeaders,
                data: transformedPayload,
                timeout: 30000
            })

            const processingTime = Date.now() - startTime

            // Update log
            logEntry.outgoingPayload = transformedPayload
            logEntry.status = 'forwarded'
            logEntry.httpStatusCode = response.status
            logEntry.thirdPartyResponse = response.data
            logEntry.processingTime = processingTime

            // Update webhook stats
            webhook.stats.totalReceived += 1
            webhook.stats.totalForwarded += 1
            webhook.stats.lastReceivedAt = new Date()
            webhook.stats.lastForwardedAt = new Date()

            result = {
                success: true,
                messageId: requestId,
                forwarded: true,
                processingTime
            }

            logger.info(`[dynamic-webhook]: Webhook ${webhookId} forwarded successfully (requestId: ${requestId})`)
        } catch (error: any) {
            const processingTime = Date.now() - startTime

            // Update log with error
            logEntry.status = 'failed'
            logEntry.errorMessage = error.message
            logEntry.processingTime = processingTime

            // Update webhook stats
            webhook.stats.totalReceived += 1
            webhook.stats.totalFailed += 1
            webhook.stats.lastReceivedAt = new Date()

            // Retry logic
            if (webhook.retryConfig && webhook.retryConfig.maxRetries > 0) {
                logger.info(`[dynamic-webhook]: Scheduling retry for webhook ${webhookId} (requestId: ${requestId})`)
                await scheduleRetry(webhook, req.body, requestId, webhook.retryConfig.maxRetries)
            }

            logger.error(`[dynamic-webhook]: Webhook ${webhookId} failed: ${error.message} (requestId: ${requestId})`)

            result = {
                success: false,
                messageId: requestId,
                error: error.message,
                processingTime
            }
        }

        // Save log and webhook stats
        await logRepo.save(logEntry)
        await webhookRepo.save(webhook)

        // Return response
        const statusCode = result.success ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR
        return res.status(statusCode).json(result)
    } catch (error) {
        logger.error(`[dynamic-webhook]: Error handling webhook: ${error}`)
        next(error)
    }
}

/**
 * Schedule webhook retry with exponential backoff
 */
const scheduleRetry = async (webhook: DynamicWebhook, payload: Record<string, any>, requestId: string, retryCount: number) => {
    const { AppDataSource } = getRunningExpressApp()

    try {
        const retryConfig = webhook.retryConfig!
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, retryConfig.maxRetries - retryCount)

        setTimeout(async () => {
            try {
                // Transform payload
                let transformedPayload = payload

                if (webhook.transformTemplate) {
                    transformedPayload = applyTransformTemplate(payload, webhook.transformTemplate)
                } else if (webhook.fieldMapping) {
                    transformedPayload = applyFieldMapping(payload, webhook.fieldMapping)
                }

                // Retry request
                const response = await axios({
                    method: webhook.targetMethod as any,
                    url: webhook.targetUrl,
                    headers: webhook.targetHeaders || {},
                    data: transformedPayload,
                    timeout: 30000
                })

                logger.info(`[dynamic-webhook]: Retry successful for webhook ${webhook.webhookId} (requestId: ${requestId})`)

                // Update log
                const logRepo = AppDataSource.getRepository(WebhookLog)
                const logEntry = logRepo.create({
                    id: uuidv4(),
                    webhookId: webhook.webhookId,
                    incomingPayload: payload,
                    outgoingPayload: transformedPayload,
                    status: 'forwarded',
                    httpStatusCode: response.status,
                    thirdPartyResponse: response.data,
                    requestId: `${requestId}-retry-${retryConfig.maxRetries - retryCount}`
                })
                await logRepo.save(logEntry)

                // Update stats
                webhook.stats.totalForwarded += 1
                await AppDataSource.getRepository(DynamicWebhook).save(webhook)
            } catch (error: any) {
                logger.error(`[dynamic-webhook]: Retry failed for webhook ${webhook.webhookId}: ${error.message}`)

                // Schedule another retry if attempts remain
                if (retryCount > 1) {
                    await scheduleRetry(webhook, payload, requestId, retryCount - 1)
                }
            }
        }, delay)
    } catch (error) {
        logger.error(`[dynamic-webhook]: Error scheduling retry: ${error}`)
    }
}

/**
 * Apply field mapping to payload
 */
const applyFieldMapping = (payload: Record<string, any>, fieldMapping: Record<string, string>): Record<string, any> => {
    const mapped: Record<string, any> = {}

    for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
        if (payload[sourceField] !== undefined) {
            mapped[targetField] = payload[sourceField]
        }
    }

    return mapped
}

/**
 * Apply transform template (simple mustache-like)
 */
const applyTransformTemplate = (payload: Record<string, any>, template: string): Record<string, any> => {
    try {
        let result = template

        // Replace {{fieldName}} with actual values
        for (const [key, value] of Object.entries(payload)) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
            result = result.replace(regex, String(value))
        }

        return JSON.parse(result)
    } catch (error) {
        logger.error(`[dynamic-webhook]: Template parsing error: ${error}`)
        return payload
    }
}
