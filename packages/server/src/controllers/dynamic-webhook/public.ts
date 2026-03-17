import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { DynamicWebhook } from '../../entities/DynamicWebhook'
import { nanoid } from 'nanoid'
import logger from '../../utils/logger'

const generateWebhookId = (): string => {
    return `wh_${nanoid(9)}`
}

/**
 * Create webhook from external source (public API)
 * POST /api/v1/public/webhooks/create
 *
 * This endpoint allows external services to create webhooks WITHOUT authentication
 * Useful for: Public API, integrations, third-party services
 */
export const createPublicWebhook = async (req: Request, res: Response, next: NextFunction) => {
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
            requireAuth = true, // Default true for security
            allowedOrigins = '*', // Default allow all for public webhooks
            rateLimit = 60,
            retryConfig,
            roomId = 'public', // Default room for public webhooks
            userId = 'public-user' // Default user for public webhooks
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

        // Generate API key
        const apiKey = `whk_${nanoid(32)}`

        // Create webhook
        const webhook = webhookRepo.create({
            id: uuidv4(),
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
            apiKey,
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
            roomId,
            userId
        })

        await webhookRepo.save(webhook)

        logger.info(`[public-webhook]: Created public webhook ${webhookId} for ${name}`)

        return res.status(StatusCodes.CREATED).json({
            success: true,
            data: {
                id: webhook.id,
                webhookId: webhook.webhookId,
                webhookUrl: `/webhook-lp/${webhook.webhookId}`,
                apiKey: webhook.apiKey,
                name: webhook.name,
                targetUrl: webhook.targetUrl,
                isActive: webhook.isActive,
                message: 'Webhook created successfully. Use the webhookUrl and apiKey to send data.'
            }
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Get public webhook details (by webhookId or API key)
 * GET /api/v1/public/webhooks/:webhookId
 *
 * Allows external services to verify their webhook configuration
 */
export const getPublicWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { AppDataSource } = getRunningExpressApp()
        const webhookRepo = AppDataSource.getRepository(DynamicWebhook)

        const { webhookId } = req.params
        const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string)

        const webhook = await webhookRepo.findOne({
            where: { webhookId, isDeleted: false }
        })

        if (!webhook) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Webhook not found')
        }

        // Verify API key if webhook requires authentication
        if (webhook.requireAuth && webhook.apiKey !== apiKey) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Invalid API key')
        }

        return res.json({
            success: true,
            data: {
                webhookId: webhook.webhookId,
                webhookUrl: `/webhook-lp/${webhook.webhookId}`,
                name: webhook.name,
                description: webhook.description,
                targetUrl: webhook.targetUrl,
                targetMethod: webhook.targetMethod,
                fieldMapping: webhook.fieldMapping,
                isActive: webhook.isActive,
                stats: webhook.stats,
                createdAt: webhook.createdAt
            }
        })
    } catch (error) {
        next(error)
    }
}
