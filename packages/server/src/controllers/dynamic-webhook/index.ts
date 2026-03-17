import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { DynamicWebhook, WebhookLog } from '../../entities/DynamicWebhook'
import { nanoid } from 'nanoid'
import axios from 'axios'
import logger from '../../utils/logger'

/**
 * Generate unique webhook ID
 * Format: wh_{9 characters}
 */
const generateWebhookId = (): string => {
    return `wh_${nanoid(9)}`
}

/**
 * Create a new dynamic webhook
 * POST /api/v1/webhooks
 */
export const createWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const {
            name,
            description,
            targetUrl,
            targetMethod = 'POST',
            targetHeaders,
            fieldMapping,
            transformTemplate,
            requireAuth = false,
            allowedOrigins,
            rateLimit = 60,
            retryConfig
        } = req.body

        // Validate required fields
        if (!name || !targetUrl) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing required fields: name, targetUrl')
        }

        // Validate URL
        try {
            new URL(targetUrl)
        } catch (error) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid targetUrl')
        }

        // Generate unique webhook ID
        let webhookId = generateWebhookId()
        let existingWebhook = await webhookRepo.findOne({ where: { webhookId } })

        // Ensure uniqueness
        while (existingWebhook) {
            webhookId = generateWebhookId()
            existingWebhook = await webhookRepo.findOne({ where: { webhookId } })
        }

        // Create webhook
        const webhook = webhookRepo.create({
            webhookId,
            name,
            description,
            targetUrl,
            targetMethod: targetMethod.toUpperCase(),
            targetHeaders: targetHeaders || {},
            fieldMapping: fieldMapping || {},
            transformTemplate,
            isActive: true,
            requireAuth,
            apiKey: requireAuth ? `whk_${nanoid(32)}` : undefined,
            allowedOrigins,
            rateLimit,
            retryConfig: retryConfig || {
                maxRetries: 3,
                retryDelay: 1000,
                backoffMultiplier: 2
            },
            stats: {
                totalReceived: 0,
                totalForwarded: 0,
                totalFailed: 0,
                lastReceivedAt: null,
                lastForwardedAt: null
            },
            roomId: req.user?.activeWorkspaceId || 'default',
            userId: req.user?.id || 'anonymous'
        })

        await webhookRepo.save(webhook)

        logger.info(`[dynamic-webhook]: Created webhook ${webhookId} for user ${req.user?.id}`)

        return res.status(StatusCodes.CREATED).json({
            success: true,
            data: {
                id: webhook.id,
                webhookId: webhook.webhookId,
                webhookUrl: `/webhook-lp/${webhook.webhookId}`,
                apiKey: webhook.apiKey,
                name: webhook.name,
                targetUrl: webhook.targetUrl,
                isActive: webhook.isActive
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Get webhook details
 * GET /api/v1/webhooks/:webhookId
 */
export const getWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const { webhookId } = req.params
        const roomId = req.user?.activeWorkspaceId || 'default'

        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        return res.json({
            success: true,
            data: {
                id: webhook.id,
                webhookId: webhook.webhookId,
                webhookUrl: `/webhook-lp/${webhook.webhookId}`,
                name: webhook.name,
                description: webhook.description,
                targetUrl: webhook.targetUrl,
                targetMethod: webhook.targetMethod,
                fieldMapping: webhook.fieldMapping,
                transformTemplate: webhook.transformTemplate,
                isActive: webhook.isActive,
                requireAuth: webhook.requireAuth,
                apiKey: webhook.apiKey,
                allowedOrigins: webhook.allowedOrigins,
                rateLimit: webhook.rateLimit,
                stats: webhook.stats,
                createdAt: webhook.createdAt,
                updatedAt: webhook.updatedAt
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * List all webhooks for user
 * GET /api/v1/webhooks
 */
export const listWebhooks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const roomId = req.user?.activeWorkspaceId || 'default'
        const userId = req.user?.id || 'anonymous'

        const webhooks = await webhookRepo.find({
            where: { roomId, userId, isDeleted: false },
            order: { createdAt: 'DESC' }
        })

        return res.json({
            success: true,
            data: webhooks.map((wh) => ({
                id: wh.id,
                webhookId: wh.webhookId,
                webhookUrl: `/webhook-lp/${wh.webhookId}`,
                name: wh.name,
                targetUrl: wh.targetUrl,
                isActive: wh.isActive,
                stats: wh.stats,
                createdAt: wh.createdAt
            }))
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Update webhook
 * PATCH /api/v1/webhooks/:webhookId
 */
export const updateWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const { webhookId } = req.params
        const roomId = req.user?.activeWorkspaceId || 'default'

        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        // Update fields
        const updatableFields = [
            'name',
            'description',
            'targetUrl',
            'targetMethod',
            'targetHeaders',
            'fieldMapping',
            'transformTemplate',
            'isActive',
            'requireAuth',
            'allowedOrigins',
            'rateLimit',
            'retryConfig'
        ]

        updatableFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                ;(webhook as any)[field] = req.body[field]
            }
        })

        await webhookRepo.save(webhook)

        logger.info(`[dynamic-webhook]: Updated webhook ${webhookId}`)

        return res.json({
            success: true,
            data: {
                id: webhook.id,
                webhookId: webhook.webhookId,
                webhookUrl: `/webhook-lp/${webhook.webhookId}`,
                name: webhook.name,
                targetUrl: webhook.targetUrl,
                isActive: webhook.isActive
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Delete webhook (soft delete)
 * DELETE /api/v1/webhooks/:webhookId
 */
export const deleteWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const { webhookId } = req.params
        const roomId = req.user?.activeWorkspaceId || 'default'

        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        webhook.isDeleted = true
        webhook.isActive = false
        await webhookRepo.save(webhook)

        logger.info(`[dynamic-webhook]: Deleted webhook ${webhookId}`)

        return res.json({
            success: true,
            message: 'Webhook deleted successfully'
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Get webhook logs
 * GET /api/v1/webhooks/:webhookId/logs
 */
export const getWebhookLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const logRepo = AppDataSource.getRepository(WebhookLog)

        const { webhookId } = req.params
        const { limit = 50, offset = 0, status } = req.query

        const roomId = req.user?.activeWorkspaceId || 'default'

        // Verify webhook exists
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)
        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        // Build query
        const where: any = { webhookId }
        if (status) {
            where.status = status
        }

        const [logs, total] = await logRepo.findAndCount({
            where,
            order: { receivedAt: 'DESC' },
            take: Number(limit),
            skip: Number(offset)
        })

        return res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset)
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Get webhook statistics
 * GET /api/v1/webhooks/:webhookId/stats
 */
export const getWebhookStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)
        const logRepo = AppDataSource.getRepository(WebhookLog)

        const { webhookId } = req.params
        const roomId = req.user?.activeWorkspaceId || 'default'

        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        // Get recent logs for detailed stats
        const recentLogs = await logRepo.find({
            where: { webhookId },
            order: { receivedAt: 'DESC' },
            take: 100
        })

        // Calculate success rate
        const successCount = recentLogs.filter((log) => log.status === 'forwarded').length
        const failureCount = recentLogs.filter((log) => log.status === 'failed').length
        const successRate = recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0

        return res.json({
            success: true,
            data: {
                webhookId: webhook.webhookId,
                name: webhook.name,
                stats: webhook.stats,
                recent: {
                    total: recentLogs.length,
                    success: successCount,
                    failure: failureCount,
                    successRate: Math.round(successRate * 100) / 100
                }
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Test webhook with sample data
 * POST /api/v1/webhooks/:webhookId/test
 */
export const testWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const { webhookId } = req.params
        const { testPayload } = req.body

        const roomId = req.user?.activeWorkspaceId || 'default'

        const webhook = await webhookRepo.findOne({
            where: { webhookId, roomId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        // Process test payload
        const result = await processWebhookPayload(
            webhook,
            testPayload || {
                email: 'test@example.com',
                phone: '+84901234567',
                name: 'Test User'
            }
        )

        return res.json({
            success: true,
            data: {
                webhookId: webhook.webhookId,
                testResult: result
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Process webhook payload and forward to third-party
 */
const processWebhookPayload = async (
    webhook: DynamicWebhook,
    payload: Record<string, any>
): Promise<{ success: boolean; response?: any; error?: string }> => {
    const startTime = Date.now()

    try {
        // Transform data if template exists
        let transformedPayload = payload

        if (webhook.transformTemplate) {
            // Simple mustache-like replacement
            transformedPayload = applyTransformTemplate(payload, webhook.transformTemplate)
        } else if (webhook.fieldMapping) {
            // Apply field mapping
            transformedPayload = applyFieldMapping(payload, webhook.fieldMapping)
        }

        // Forward to third-party
        const response = await axios({
            method: webhook.targetMethod as any,
            url: webhook.targetUrl,
            headers: webhook.targetHeaders || {},
            data: transformedPayload,
            timeout: 30000 // 30 seconds
        })

        const processingTime = Date.now() - startTime

        return {
            success: true,
            response: {
                status: response.status,
                data: response.data,
                processingTime
            }
        }
    } catch (error: any) {
        const processingTime = Date.now() - startTime

        return {
            success: false,
            error: error.message,
            response: {
                processingTime
            }
        }
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
