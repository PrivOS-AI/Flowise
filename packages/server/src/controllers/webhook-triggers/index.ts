import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { utilBuildChatflow } from '../../utils/buildChatflow'

export enum PrivosEvent {
    MESSAGE_NEW = 'message.new',
    MESSAGE_EDITED = 'message.edited',
    MESSAGE_DELETED = 'message.deleted',
    ROOM_JOINED = 'room.joined',
    ROOM_LEFT = 'room.left',
    USER_JOINED = 'user.joined',
    USER_LEFT = 'user.left'
}

interface IBot {
    id: string
    username: string
    name: string
}

interface IRoom {
    id: string
    name: string
    type: string
}

interface IMessage {
    id: string
    text: string
    userId: string
    username: string
    createdAt?: string
}

interface IUser {
    id: string
    username: string
    name: string
}

interface WebhookEventRequest {
    event: string
    timestamp: string
    bot?: IBot
    room?: IRoom
    message?: IMessage
    user?: IUser
}

/**
 * Handle incoming webhook events
 * POST /api/v1/webhook/events
 */
const handleWebhookEvent = async (req: Request, res: Response, next: NextFunction) => {
    const appServer = getRunningExpressApp()

    try {
        console.log('Received webhook event: ', req.body)
        if (!req.body.event) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Missing eventType')

        const body = req.body as WebhookEventRequest
        const { room, bot, message, event: eventType } = body
        if (bot?.id === message?.userId) {
            console.log('[server]: Ignoring event triggered by the bot itself to prevent loops.')
            return res.status(200).json({ success: true, message: `Ignored event ${eventType} triggered by the bot itself.` })
        }

        // Find agentFlows with CommonTrigger node matching this eventType
        const matchingAgentFlows: any[] = []
        const allChatFlows = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: { type: 'AGENTFLOW' }
        })

        for (const chatFlow of allChatFlows) {
            const flowData = JSON.parse(chatFlow.flowData)
            const nodes = flowData.nodes || []
            // find all trigger nodes
            const triggerNodes = nodes
                .filter((node: any) => node.data.type === 'triggerProcessor' && node.data.triggerType === eventType)
                .map((node: any) => {
                    return {
                        nodeId: node.id,
                        nodeName: node.data.label || node.data.name,
                        events: [node.data.triggerType],
                        startNode: node.data,
                        credentialId: node.data.credential
                    }
                })

            if (triggerNodes.length > 0) {
                matchingAgentFlows.push({
                    id: chatFlow.id,
                    name: chatFlow.name,
                    flowData: chatFlow.flowData,
                    type: chatFlow.type,
                    workspaceId: chatFlow.workspaceId,
                    triggerNodes,
                    credentialId: triggerNodes[0].credentialId
                })
            }
        }
        console.log(`[server]: Found ${matchingAgentFlows.length} agentflow(s) for eventType: ${eventType}`)

        // Execute each matching agentFlow
        for (const agentFlow of matchingAgentFlows) {
            req.params.id = agentFlow.id
            // The data from webhook payload will be passed as 'question' to the flow
            // Nodes can access it via {{question}} variable
            req.body.question = JSON.stringify({
                eventType,
                timestamp: new Date().toISOString(),
                payload: body || {}
            })
            req.body.triggerData = {
                botCredentialId: agentFlow.credentialId,
                roomId: room?.id,
                messageId: message?.id
            }
            await utilBuildChatflow(req, true, true)
        }

        return res.json({ success: true, message: `Webhook event ${eventType} processed` })
    } catch (error) {
        next(error)
    }
}

export default {
    handleWebhookEvent
}
