import { Request } from 'express'
import { validate as isUUID } from 'uuid'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { utilBuildChatflow } from '../../utils/buildChatflow'
import logger from '../../utils/logger'
import { ChatflowType } from '../../Interface'
import { Trigger } from '../../database/entities/Trigger'
import { decryptCredentialData } from 'flowise-components'
import { Credential } from '../../database/entities/Credential'

// ============================================================================
// Types & Interfaces
// ============================================================================

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
    form?: Record<string, any>
    question?: string
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
const isBotTriggeredEvent = (botId: string | undefined, messageUserId: string | undefined): boolean => {
    return botId != null && messageUserId != null && botId === messageUserId
}

/**
 * Find all trigger nodes in a flow that match the given event type
 */
const findMatchingTriggerNodes = (nodes: any[], triggerData: Trigger, eventType: string): ITriggerNode[] => {
    return nodes
        .filter((node: any) => node.data?.type === 'triggerProcessor' && triggerData.events.includes(eventType))
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
const parseFlowForTriggers = (flowDataString: string, triggerData: Trigger, eventType: string): ITriggerNode[] => {
    try {
        const flowData = JSON.parse(flowDataString)
        const nodes = flowData?.nodes || []
        return findMatchingTriggerNodes(nodes, triggerData, eventType)
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
const findMatchingAgentFlows = async (eventType: string, bot?: IBot) => {
    const appServer = getRunningExpressApp()
    const matchingAgentFlows: IMatchingAgentFlow[] = []

    try {
        // get trigger from botId
        const triggerData = await appServer.AppDataSource.getRepository(Trigger).findOneBy({ botId: bot?.id, isEnabled: true })
        if (!triggerData) throw new Error('Trigger not found')

        const allChatFlows = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: { type: 'AGENTFLOW', id: triggerData.flowId }
        })

        for (const chatFlow of allChatFlows) {
            const triggerNodes = parseFlowForTriggers(chatFlow.flowData, triggerData, eventType)
            const agentFlow = convertToMatchingAgentFlow(chatFlow, triggerNodes)
            if (agentFlow) {
                matchingAgentFlows.push(agentFlow)
            }
        }

        return { matchingAgentFlows, triggerConfig: triggerData.config }
    } catch (error) {
        logger.error(`[webhook-triggers]: Error finding matching agent flows: ${error}`)
        throw error
    }
}

/**
 * Find a specific agent flow by slug or ID that has trigger nodes matching the event type
 */
const findMatchingAgentFlowBySlug = async (slug: string, eventType: string) => {
    const appServer = getRunningExpressApp()
    const isSlugUUID = isUUID(slug)

    try {
        const triggerData = await appServer.AppDataSource.getRepository(Trigger).findOneBy(isSlugUUID ? { id: slug } : { slug })
        if (!triggerData) throw new Error('Trigger not found')
        if (triggerData.isEnabled === false) throw new Error('Trigger is disabled')

        const chatFlow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({
            type: 'AGENTFLOW',
            id: triggerData.flowId
        })

        if (!chatFlow) return { agentFlow: null, triggerConfig: null }

        const triggerNodes = parseFlowForTriggers(chatFlow.flowData, triggerData, eventType)
        return { agentFlow: convertToMatchingAgentFlow(chatFlow, triggerNodes), triggerConfig: triggerData.config }
    } catch (error) {
        logger.error(`[webhook-triggers]: Error finding agent flow by slug: ${error}`)
        throw error
    }
}

/**
 * Prepare the request body with chatflow data for execution
 */
const prepareChatFlowExecutionRequest = async (req: Request, agentFlow: IMatchingAgentFlow): Promise<void> => {
    const appServer = getRunningExpressApp()
    const credential = await appServer.AppDataSource.getRepository(Credential).findOneBy({ id: agentFlow.credentialId })
    if (!credential) throw new Error('Credential data not found')
    const { authToken } = await decryptCredentialData(credential.encryptedData)

    const { form = {}, question = '', room, roomId, message, messageId, event = '', triggerConfig } = req.body ?? {}
    req.params.id = agentFlow.id
    const formBuilt = {
        ...form,
        messageId: message?._id || message?.id || messageId,
        event,
        botId: req.body.bot?.id,
        botTokenKey: authToken,
        message: JSON.stringify(message),
        mainMessageId: form?.metadata?.mainMessageId || message?._id
    }
    req.body.form = formBuilt
    req.body.triggerData = {
        ...req.body,
        form,
        question,
        botCredentialId: agentFlow.credentialId,
        roomId: room?.id ?? roomId,
        messageId: message?._id || message?.id || messageId,
        eventType: event,
        config: triggerConfig
    }
}

/**
 * Execute a single agent flow
 */
const executeAgentFlow = async (req: Request, agentFlow: IMatchingAgentFlow): Promise<void> => {
    try {
        await prepareChatFlowExecutionRequest(req, agentFlow)
        await utilBuildChatflow(req, true)
    } catch (error) {
        logger.error(`[webhook-triggers]: Error executing agentflow ${agentFlow.id}: ${error}`)
        throw error
    }
}

/**
 * Process webhook event for all matching agent flows
 */
export const processWebhookEvent = async (req: Request): Promise<IWebhookEventResult> => {
    const { bot, message, event: eventType } = req.body as WebhookEventRequest

    // Prevent bot-triggered event loops
    // Find all matching agent flows
    const { matchingAgentFlows, triggerConfig } = await findMatchingAgentFlows(eventType, bot)

    if (matchingAgentFlows.length === 0) {
        return {
            success: true,
            message: `No agentflows found for eventType: ${eventType}`
        }
    }

    req.body.triggerConfig = triggerConfig
    // Execute each matching agent flow
    for (const agentFlow of matchingAgentFlows) {
        try {
            await executeAgentFlow(req, agentFlow)
        } catch (error) {
            logger.error(`[webhook-triggers]: Failed to execute agentflow ${agentFlow.id}: ${error}`)
        }
    }

    return {
        success: true,
        message: `Webhook event ${eventType} processed`
    }
}

/**
 * Process webhook event for a specific agent flow identified by slug
 */
export const processWebhookEventBySlug = async (req: Request, slug: string): Promise<IWebhookEventResult> => {
    const { bot, message, event: eventType } = req.body as WebhookEventRequest

    if (isBotTriggeredEvent(bot?.id, message?.userId)) {
        return {
            success: true,
            message: `Ignored event ${eventType} triggered by the bot itself.`
        }
    }

    // Find the specific agent flow by slug
    const { agentFlow, triggerConfig } = await findMatchingAgentFlowBySlug(slug, eventType)
    if (!agentFlow)
        return {
            success: false,
            message: `No agentflow found for slug: ${slug}`
        }

    req.body.triggerConfig = triggerConfig
    // Execute the agent flow
    await executeAgentFlow(req, agentFlow)
    return {
        success: true,
        message: `Webhook event ${eventType} processed`
    }
}

export default {
    processWebhookEvent,
    processWebhookEventBySlug
}
