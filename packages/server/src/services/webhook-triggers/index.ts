import { Request } from 'express'
import { validate as isUUID } from 'uuid'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { utilBuildChatflow } from '../../utils/buildChatflow'
import logger from '../../utils/logger'
import { ChatflowType } from '../../Interface'

// ============================================================================
// Types & Interfaces
// ============================================================================

export enum PrivosEvent {
    MESSAGE_NEW = 'message.new',
    MESSAGE_EDITED = 'message.edited',
    MESSAGE_DELETED = 'message.deleted',
    ROOM_JOINED = 'room.joined',
    ROOM_LEFT = 'room.left',
    USER_JOINED = 'user.joined',
    USER_LEFT = 'user.left'
}

export interface IBot {
    id: string
    username: string
    name: string
}

export interface IRoom {
    id: string
    name: string
    type: string
}

export interface IMessage {
    id: string
    text: string
    userId: string
    username: string
    createdAt?: string
}

export interface IUser {
    id: string
    username: string
    name: string
}

export interface WebhookEventRequest {
    event: string
    timestamp: string
    bot?: IBot
    room?: IRoom
    message?: IMessage
    user?: IUser
}

export interface ITriggerNode {
    nodeId: string
    nodeName: string
    events: string[]
    startNode: any
    credentialId?: string
}

export interface IMatchingAgentFlow {
    id: string
    name: string
    flowData: string
    type?: ChatflowType
    workspaceId: string
    triggerNodes: ITriggerNode[]
    credentialId?: string
}

export interface IWebhookEventResult {
    success: boolean
    message: string
    processedCount?: number
    ignoredCount?: number
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Check if the event was triggered by the bot itself to prevent loops
 */
export const isBotTriggeredEvent = (botId: string | undefined, messageUserId: string | undefined): boolean => {
    return botId != null && messageUserId != null && botId === messageUserId
}

/**
 * Find all trigger nodes in a flow that match the given event type
 */
const findMatchingTriggerNodes = (nodes: any[], eventType: string): ITriggerNode[] => {
    return nodes
        .filter((node: any) => node.data?.type === 'triggerProcessor' && node.data?.eventType === eventType)
        .map((node: any) => ({
            nodeId: node.id,
            nodeName: node.data?.label || node.data?.name || '',
            events: [node.data?.eventType],
            startNode: node.data,
            credentialId: node.data?.credential
        }))
}

/**
 * Parse flow data and extract matching trigger nodes
 */
const parseFlowForTriggers = (flowDataString: string, eventType: string): ITriggerNode[] => {
    try {
        const flowData = JSON.parse(flowDataString)
        const nodes = flowData?.nodes || []
        return findMatchingTriggerNodes(nodes, eventType)
    } catch (error) {
        logger.error(`[webhook-triggers]: Error parsing flow data: ${error}`)
        return []
    }
}

/**
 * Convert a ChatFlow entity to a matching agent flow object if it contains matching trigger nodes
 */
const convertToMatchingAgentFlow = (chatFlow: ChatFlow, triggerNodes: ITriggerNode[]): IMatchingAgentFlow | null => {
    if (triggerNodes.length === 0) {
        return null
    }

    return {
        id: chatFlow.id,
        name: chatFlow.name,
        flowData: chatFlow.flowData,
        type: chatFlow.type,
        workspaceId: chatFlow.workspaceId || '',
        triggerNodes,
        credentialId: triggerNodes[0].credentialId
    }
}

/**
 * Find all agent flows that have trigger nodes matching the given event type
 */
export const findMatchingAgentFlows = async (eventType: string): Promise<IMatchingAgentFlow[]> => {
    const appServer = getRunningExpressApp()
    const matchingAgentFlows: IMatchingAgentFlow[] = []

    try {
        const allChatFlows = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: { type: 'AGENTFLOW' }
        })

        for (const chatFlow of allChatFlows) {
            const triggerNodes = parseFlowForTriggers(chatFlow.flowData, eventType)
            const agentFlow = convertToMatchingAgentFlow(chatFlow, triggerNodes)
            if (agentFlow) {
                matchingAgentFlows.push(agentFlow)
            }
        }

        logger.info(`[webhook-triggers]: Found ${matchingAgentFlows.length} agentflow(s) for eventType: ${eventType}`)
        return matchingAgentFlows
    } catch (error) {
        logger.error(`[webhook-triggers]: Error finding matching agent flows: ${error}`)
        throw error
    }
}

/**
 * Find a specific agent flow by slug or ID that has trigger nodes matching the event type
 */
export const findMatchingAgentFlowBySlug = async (slug: string, eventType: string): Promise<IMatchingAgentFlow | null> => {
    const appServer = getRunningExpressApp()
    const isSlugUUID = isUUID(slug)

    try {
        const chatFlow = await appServer.AppDataSource.getRepository(ChatFlow).findOne({
            where: isSlugUUID ? { id: slug, type: 'AGENTFLOW' } : { slug: slug, type: 'AGENTFLOW' }
        })

        if (!chatFlow) {
            return null
        }

        const triggerNodes = parseFlowForTriggers(chatFlow.flowData, eventType)
        return convertToMatchingAgentFlow(chatFlow, triggerNodes)
    } catch (error) {
        logger.error(`[webhook-triggers]: Error finding agent flow by slug: ${error}`)
        throw error
    }
}

/**
 * Prepare the request body with chatflow data for execution
 */
export const prepareChatflowExecutionRequest = (req: Request, agentFlow: IMatchingAgentFlow, webhookData: WebhookEventRequest): void => {
    const { room, message, event: eventType } = webhookData

    // Set the chatflow ID in params
    req.params.id = agentFlow.id

    // Nodes can access it via {{question}} variable
    req.body.question = JSON.stringify({
        eventType,
        timestamp: new Date().toISOString(),
        payload: webhookData || {}
    })

    // Set trigger data for internal processing
    req.body.triggerData = {
        botCredentialId: agentFlow.credentialId,
        roomId: room?.id,
        messageId: message?.id,
        eventType
    }
}

/**
 * Execute a single agent flow
 */
export const executeAgentFlow = async (req: Request, agentFlow: IMatchingAgentFlow, webhookData: WebhookEventRequest): Promise<void> => {
    try {
        prepareChatflowExecutionRequest(req, agentFlow, webhookData)
        await utilBuildChatflow(req, true)
        logger.info(`[webhook-triggers]: Successfully executed agentflow: ${agentFlow.name} (${agentFlow.id})`)
    } catch (error) {
        logger.error(`[webhook-triggers]: Error executing agentflow ${agentFlow.id}: ${error}`)
        throw error
    }
}

/**
 * Process webhook event for all matching agent flows
 */
export const processWebhookEvent = async (req: Request, webhookData: WebhookEventRequest): Promise<IWebhookEventResult> => {
    const { bot, message, event: eventType } = webhookData

    // Prevent bot-triggered event loops
    if (isBotTriggeredEvent(bot?.id, message?.userId)) {
        logger.info(`[webhook-triggers]: Ignoring event ${eventType} triggered by the bot itself to prevent loops.`)
        return {
            success: true,
            message: `Ignored event ${eventType} triggered by the bot itself.`,
            ignoredCount: 1
        }
    }

    // Find all matching agent flows
    const matchingAgentFlows = await findMatchingAgentFlows(eventType)

    if (matchingAgentFlows.length === 0) {
        logger.info(`[webhook-triggers]: No agentflows found for eventType: ${eventType}`)
        return {
            success: true,
            message: `No agentflows found for eventType: ${eventType}`,
            processedCount: 0
        }
    }

    // Execute each matching agent flow
    let processedCount = 0
    for (const agentFlow of matchingAgentFlows) {
        try {
            await executeAgentFlow(req, agentFlow, webhookData)
            processedCount++
        } catch (error) {
            logger.error(`[webhook-triggers]: Failed to execute agentflow ${agentFlow.id}: ${error}`)
            // Continue with other flows even if one fails
        }
    }

    return {
        success: true,
        message: `Webhook event ${eventType} processed`,
        processedCount
    }
}

/**
 * Process webhook event for a specific agent flow identified by slug
 */
export const processWebhookEventBySlug = async (
    req: Request,
    slug: string,
    webhookData: WebhookEventRequest
): Promise<IWebhookEventResult> => {
    const { bot, message, event: eventType } = webhookData

    // Prevent bot-triggered event loops
    if (isBotTriggeredEvent(bot?.id, message?.userId)) {
        logger.info(`[webhook-triggers]: Ignoring event ${eventType} triggered by the bot itself to prevent loops.`)
        return {
            success: true,
            message: `Ignored event ${eventType} triggered by the bot itself.`,
            ignoredCount: 1
        }
    }

    // Find the specific agent flow by slug
    const agentFlow = await findMatchingAgentFlowBySlug(slug, eventType)

    if (!agentFlow) {
        return {
            success: false,
            message: `No agentflow found for slug: ${slug}`,
            processedCount: 0
        }
    }

    // Execute the agent flow
    await executeAgentFlow(req, agentFlow, webhookData)

    return {
        success: true,
        message: `Webhook event ${eventType} processed`,
        processedCount: 1
    }
}

export default {
    isBotTriggeredEvent,
    findMatchingAgentFlows,
    findMatchingAgentFlowBySlug,
    prepareChatflowExecutionRequest,
    executeAgentFlow,
    processWebhookEvent,
    processWebhookEventBySlug
}
