import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import webhookTriggersService from '../../services/webhook-triggers'

/**
 * Handle incoming webhook events (for privOs system)
 * POST /api/v1/webhook
 */
const handleWebhookEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { event } = req.body
        if (!event) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing eventType')

        const result = await webhookTriggersService.processWebhookEvent(req)
        if (!result.success) return res.status(StatusCodes.NOT_FOUND).json(result)

        return res.json(result)
    } catch (error) {
        next(error)
    }
}

/**
 * Handle incoming webhook events by slug
 * POST /api/v1/webhook/:slug
 */
const handleWebhookEventBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { event } = req.body
        const { slug } = req.params

        if (!event) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing eventType')

        const result = await webhookTriggersService.processWebhookEventBySlug(req, slug)
        if (!result.success) return res.status(StatusCodes.NOT_FOUND).json(result)

        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export default {
    handleWebhookEvent,
    handleWebhookEventBySlug
}
