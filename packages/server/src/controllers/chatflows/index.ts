import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { ChatflowType, MODE } from '../../Interface'
import apiKeyService from '../../services/apikey'
import chatflowsService from '../../services/chatflows'
import triggerService from '../../services/triggers'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../utils/quotaUsage'
import { RateLimiterManager } from '../../utils/rateLimit'
import { getPageAndLimitParams } from '../../utils/pagination'
import { WorkspaceUserErrorMessage, WorkspaceUserService } from '../../enterprise/services/workspace-user.service'
import { QueryRunner, In, Not } from 'typeorm'
import { GeneralErrorMessage, OMIT_QUEUE_JOB_DATA } from '../../utils/constants'
import { ScheduleManager } from '../../services/schedule-manager'
import { Trigger } from '../../database/entities/Trigger'
import { Credential } from '../../database/entities/Credential'
import { decryptCredentialData } from '../../utils'
import { getBullMQJobOptions, ITriggerConfig, parseConfig, convertToBullMQConfig } from 'flowise-components'
import { omit } from 'lodash'
import logger from '../../utils/logger'

const checkIfChatflowIsValidForStreaming = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowIsValidForStreaming - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForStreaming(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowIsValidForUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowIsValidForUploads - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForUploads(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsController.deleteChatflow - id not provided!`)
        }

        // Room isolation: Check if user can delete this chatflow
        const chatflow = await chatflowsService.getChatflowById(req.params.id)
        if (!chatflow) {
            return res.status(404).send(`Chatflow ${req.params.id} not found`)
        }

        // Prevent room users from deleting global resources
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(
                StatusCodes.FORBIDDEN,
                `Error: chatflowsController.deleteChatflow - Cannot delete global resources. This chatflow was created by a root admin and is read-only for room users.`
            )
        }

        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.deleteChatflow - organization ${orgId} not found!`
            )
        }
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.deleteChatflow - workspace ${workspaceId} not found!`
            )
        }
        const apiResponse = await chatflowsService.deleteChatflow(req.params.id, orgId, workspaceId)

        const appServer = getRunningExpressApp()
        const triggerRepo = appServer.AppDataSource.getRepository(Trigger)
        const existingTriggers = await triggerRepo.findBy({ flowId: req.params.id })
        for (const trigger of existingTriggers) {
            await removeJobSchedule(orgId, req.params.id, trigger)
        }
        await triggerService.deleteManyTrigger({ flowId: req.params.id })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = getPageAndLimitParams(req)

        const apiResponse = await chatflowsService.getAllChatflows(
            req.query?.type as ChatflowType,
            req.user?.activeWorkspaceId,
            page,
            limit,
            req.roomId,
            req.isRootAdmin
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Get specific chatflow via api key
const getChatflowByApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getChatflowByApiKey - apikey not provided!`
            )
        }
        const apikey = await apiKeyService.getApiKey(req.params.apikey)
        if (!apikey) {
            return res.status(401).send('Unauthorized')
        }
        const apiResponse = await chatflowsService.getChatflowByApiKey(apikey.id, req.query.keyonly)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getChatflowById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsController.getChatflowById - id not provided!`)
        }
        const apiResponse = await chatflowsService.getChatflowById(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsController.saveChatflow - body not provided!`)
        }
        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.saveChatflow - organization ${orgId} not found!`
            )
        }
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.saveChatflow - workspace ${workspaceId} not found!`
            )
        }
        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''
        const body = req.body

        // validate bot credential for trigger
        const collectTriggerData = await validateCredentialBot(body.flowData, '', workspaceId)

        const existingChatflowCount = await chatflowsService.getAllChatflowsCountByOrganization(body.type, orgId)
        const newChatflowCount = 1
        await checkUsageLimit('flows', subscriptionId, getRunningExpressApp().usageCacheManager, existingChatflowCount + newChatflowCount)

        const newChatFlow = new ChatFlow()
        Object.assign(newChatFlow, body)
        newChatFlow.workspaceId = workspaceId

        // Room isolation: Only set roomId if user is NOT root admin
        if (!req.isRootAdmin && req.roomId) {
            newChatFlow.roomId = req.roomId
        }

        const apiResponse = await chatflowsService.saveChatflow(
            newChatFlow,
            orgId,
            workspaceId,
            subscriptionId,
            getRunningExpressApp().usageCacheManager
        )

        // Update triggers, minimal -> don't batch
        if (collectTriggerData.length > 0) {
            await handleTriggerData(collectTriggerData, apiResponse?.id, workspaceId, orgId)
        }

        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsController.updateChatflow - id not provided!`)
        }
        const chatflow = await chatflowsService.getChatflowById(req.params.id)
        const currentFlow = chatflow?.flowData || ''
        if (!chatflow) {
            return res.status(404).send(`Chatflow ${req.params.id} not found`)
        }

        // Room isolation: Prevent room users from editing global resources
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `You don't have permission to edit this resource`)
        }

        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.saveChatflow - organization ${orgId} not found!`
            )
        }
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chatflowsController.saveChatflow - workspace ${workspaceId} not found!`
            )
        }
        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''
        const body = req.body
        // validate bot credential for trigger
        const collectTriggerData = await validateCredentialBot(body.flowData, chatflow.id, workspaceId)

        // check duplicate slug
        await validateSlug(chatflow, workspaceId, body.slug)

        // check duplicate slug
        if (body.slug) {
            const isNeedCheck = !chatflow.slug || chatflow.slug?.toLowerCase() !== body.slug.toLowerCase().trim()
            isNeedCheck && (await chatflowsService.checkDuplicateSlug(body.slug))
        }

        const updateChatFlow = new ChatFlow()
        Object.assign(updateChatFlow, body)

        updateChatFlow.id = chatflow.id
        const rateLimiterManager = RateLimiterManager.getInstance()
        await rateLimiterManager.updateRateLimiter(updateChatFlow)

        const apiResponse = await chatflowsService.updateChatflow(chatflow, updateChatFlow, orgId, workspaceId, subscriptionId)

        // Update triggers, minimal -> don't batch
        if (collectTriggerData.length > 0) {
            await handleTriggerData(collectTriggerData, chatflow.id, workspaceId, orgId, currentFlow)
        }

        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const handleTriggerData = async (triggerData: any[], flowId: string, workspaceId: string, orgId: string, currentFlow?: string) => {
    const appServer = getRunningExpressApp()
    const triggerRepo = appServer.AppDataSource.getRepository(Trigger)

    // Get triggers data
    const ids = triggerData.map((t) => t.id).filter(Boolean)
    const existingTriggers = await triggerRepo.findBy({ id: In(ids) })

    const triggerMap = new Map(existingTriggers.map((t: any) => [t.id, t]))

    const toUpdate: Trigger[] = []
    const toInsert: Trigger[] = []

    for (const { id, ...rest } of triggerData) {
        const existing = id ? triggerMap.get(id) : null
        const finalData = { ...rest, flowId, workspaceId }
        if (existing) {
            triggerRepo.merge(existing, finalData)
            toUpdate.push(existing as any)
        } else {
            toInsert.push({ id, ...finalData } as any)
        }
    }

    toUpdate.length > 0 && (await triggerRepo.save(toUpdate))
    toInsert.length > 0 && (await triggerRepo.insert(toInsert))

    // schedule triggers
    const toInsertSchedule = toInsert.filter((t) => t.type === 'schedule')
    const toUpdateSchedule = toUpdate.filter((t) => t.type === 'schedule')

    for (const trigger of toInsertSchedule) {
        await handleJobSchedule(orgId, flowId, trigger)
    }
    for (const trigger of toUpdateSchedule) {
        await handleJobSchedule(orgId, flowId, trigger, true)
    }

    // compare to trigger nodes in currentFlow and delete removed triggers
    if (currentFlow) {
        const flowData = JSON.parse(currentFlow)
        const nodes = flowData.nodes ?? []
        const triggerNodes = nodes.filter((node: any) => node.data.type === 'triggerProcessor')
        const currentWebhookIds = triggerNodes.map((node: any) => node.data.trigger?.webhookId).filter(Boolean)
        const newWebhookIds = toUpdate.map((t) => t.id).filter(Boolean)
        const webhookIdsToDelete = currentWebhookIds.filter((webhookId: string) => !newWebhookIds.includes(webhookId))

        if (webhookIdsToDelete.length > 0) {
            const triggersToDelete = await triggerRepo.findBy({ id: In(webhookIdsToDelete) })
            for (const trigger of triggersToDelete) {
                await removeJobSchedule(orgId, flowId, trigger)
            }

            await triggerRepo.remove(triggersToDelete)
        }
    }
}

const validateCredentialBot = async (data: any, flowId: string, workspaceId: string) => {
    if (!data) return []

    const appServer = getRunningExpressApp()
    const triggerRepo = appServer.AppDataSource.getRepository(Trigger)
    const credentialRepo = appServer.AppDataSource.getRepository(Credential)
    const collectTriggerData = []
    const flowData = JSON.parse(data)
    const nodes = flowData.nodes ?? []
    const triggerNodes = nodes.filter((node: any) => node.data.type === 'triggerProcessor')
    const credentialEventMap = new Map<string, { events: Set<string>; labels: Map<string, string> }>()
    // Check duplicate credential in the same flow
    for (const node of triggerNodes) {
        const { credential, label, inputs } = node.data
        const events: string[] = JSON.parse(inputs?.events || '[]')
        if (events.length === 0) continue

        if (!credential || typeof credential !== 'string') {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Trigger '${label}' must have a valid credential.`)
        }

        if (!credentialEventMap.has(credential)) {
            credentialEventMap.set(credential, { events: new Set(), labels: new Map() })
        }

        const meta = credentialEventMap.get(credential)!

        for (const event of events) {
            if (meta.events.has(event)) {
                throw new InternalFlowiseError(
                    StatusCodes.CONFLICT,
                    `Duplicate event for credential in trigger '${label}'. Each event must be unique per credential.`
                )
            }
            meta.events.add(event)
            meta.labels.set(event, label)
        }
    }
    // decrypt to get botId
    const credentialIds = Array.from(credentialEventMap.keys())
    const existingCredentials = await credentialRepo.findBy({ id: In(credentialIds) })
    const decryptedCredentials = await Promise.all(
        existingCredentials.map(async (credential: any) => {
            const decrypted = await decryptCredentialData(credential?.encryptedData)
            return {
                credentialId: credential.id,
                botId: decrypted?.botId
            }
        })
    )
    const botIds = decryptedCredentials.filter((c: any) => c.botId).map((c: any) => c.botId)
    const credentialBotMap = new Map<string, string>(
        decryptedCredentials.filter((c: any) => c.botId).map((c: any) => [c.botId, c.credentialId])
    )
    const reverseCredentialBotMap = new Map<string, string>(
        decryptedCredentials.filter((c: any) => c.credentialId).map((c: any) => [c.credentialId, c.botId])
    )

    // Check credential used in other flows, optimize using table (later)
    const existingTriggers = await triggerRepo.find({
        where: {
            botId: In(botIds),
            ...(flowId && { flowId: Not(flowId) }),
            workspaceId
        }
    })
    for (const trigger of existingTriggers) {
        const credential = credentialBotMap.get(trigger.botId)
        const meta = credentialEventMap.get(credential!)
        if (!meta) continue

        for (const event of trigger.events ?? []) {
            if (meta.events.has(event)) {
                throw new InternalFlowiseError(
                    StatusCodes.CONFLICT,
                    `Credential for '${meta.labels.get(event)}' is already in use in another flow`
                )
            }
        }
    }

    // Collect trigger data
    for (const node of triggerNodes) {
        const {
            trigger,
            inputs: { isEnabled, events, description, updateFLowState, retryOnFail, credential, ...config },
            triggerType
        } = node.data
        if (!trigger?.webhookId) continue

        let finalConfig: ITriggerConfig = {
            isEnabled: Boolean(retryOnFail || false), // on/off
            ...config // other config first, then override to prevent error type
        }
        if (retryOnFail) {
            finalConfig.retry = {
                attempts: Number(config.attempts || '3'),
                backoff: {
                    delay: Number(config.backoff || '3000'),
                    type: config.type || 'fixed'
                }
            }
        }
        if (triggerType === 'schedule') {
            const config = parseConfig(node.data)
            const repeatOptions = convertToBullMQConfig(config)
            const jobOptions = getBullMQJobOptions(config, repeatOptions)
            finalConfig.schedule = jobOptions
        }

        collectTriggerData.push({
            id: trigger?.webhookId,
            type: node.data?.triggerType || 'privos',
            slug: trigger?.slug || null,
            isEnabled: isEnabled || false,
            events: triggerType === 'schedule' ? ['schedule'] : JSON.parse(events || '[]'),
            description: description || '',
            botId: reverseCredentialBotMap.get(credential) || null,
            config: finalConfig
        })
    }

    return collectTriggerData
}

const validateSlug = async (chatflow: any, workspaceId: string, slug?: string) => {
    if (!slug) return
    const isNeedCheck = !chatflow.slug || chatflow.slug?.toLowerCase() !== slug.toLowerCase().trim()
    isNeedCheck && (await chatflowsService.checkDuplicateSlug(slug, workspaceId))
}

const handleJobSchedule = async (orgId: any, flowId: string, data: any, isRemove: boolean = false) => {
    const appServer = getRunningExpressApp()
    const triggerRepo = appServer.AppDataSource.getRepository(Trigger)
    const { config, ...jobData } = data

    if (process.env.MODE === MODE.QUEUE) {
        const scheduleQueue = appServer.queueManager.getQueue('schedule')
        if (isRemove) await removeJobSchedule(orgId, flowId, data)

        if (jobData?.isEnabled) {
            const job = await scheduleQueue.addJob(
                omit({ chatFlowId: flowId, triggerId: data?.id }, OMIT_QUEUE_JOB_DATA),
                config?.schedule || {}
            )
            logger.debug(`[server]: [${orgId}/${flowId}/schedule]: Job added to queue: ${job.id}`)
            await triggerRepo.update(jobData.id, { jobKey: job.repeatJobKey })
        }
    }
}

const removeJobSchedule = async (orgId: any, flowId: string, data: any) => {
    const appServer = getRunningExpressApp()

    if (process.env.MODE === MODE.QUEUE) {
        const scheduleQueue = appServer.queueManager.getQueue('schedule')
        const queue = scheduleQueue.getQueue()
        data?.jobKey && (await queue.removeJobScheduler(data?.jobKey))
        logger.debug(`[server]: [${orgId}/${flowId}/schedule]: Removed old job with id: ${data?.jobKey}`)
    }
}

const getSinglePublicChatflow = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner: QueryRunner | undefined
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getSinglePublicChatflow - id not provided!`
            )
        }
        const chatflow = await chatflowsService.getChatflowById(req.params.id)
        if (!chatflow) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Chatflow not found' })
        if (chatflow.isPublic) return res.status(StatusCodes.OK).json(chatflow)
        if (!req.user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: GeneralErrorMessage.UNAUTHORIZED })
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        const workspaceUserService = new WorkspaceUserService()
        const workspaceUser = await workspaceUserService.readWorkspaceUserByUserId(req.user.id, queryRunner)
        if (workspaceUser.length === 0)
            return res.status(StatusCodes.NOT_FOUND).json({ message: WorkspaceUserErrorMessage.WORKSPACE_USER_NOT_FOUND })
        const workspaceIds = workspaceUser.map((user) => user.workspaceId)
        if (!workspaceIds.includes(chatflow.workspaceId))
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'You are not in the workspace that owns this chatflow' })
        return res.status(StatusCodes.OK).json(chatflow)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const getSinglePublicChatbotConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getSinglePublicChatbotConfig - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.getSinglePublicChatbotConfig(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowHasChanged = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowHasChanged - id not provided!`
            )
        }
        if (!req.params.lastUpdatedDateTime) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.checkIfChatflowHasChanged - lastUpdatedDateTime not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowHasChanged(req.params.id, req.params.lastUpdatedDateTime)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Schedule Management Endpoints

const updateChatflowSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.updateChatflowSchedule - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const scheduleConfig = req.body

        // Validate cron expression (basic validation)
        if (scheduleConfig.cronExpression && !isValidCronExpression(scheduleConfig.cronExpression)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Error: Invalid cron expression`)
        }

        // Get chatflow and update schedule config
        const chatflow = await chatflowsService.getChatflowById(chatflowId)
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(
                StatusCodes.FORBIDDEN,
                `Error: Cannot modify schedule for global resources. This chatflow was created by a root admin.`
            )
        }

        // Update chatflow with new schedule config
        chatflow.scheduleConfig = JSON.stringify(scheduleConfig)
        chatflow.scheduleEnabled = scheduleConfig.enabled || false

        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Organization not found`)
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Workspace not found`)
        }

        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''

        const updatedChatflow = await chatflowsService.updateChatflow(chatflow, chatflow, orgId, workspaceId, subscriptionId)

        // Update schedule in ScheduleManager
        const scheduleManager = ScheduleManager.getInstance()
        await scheduleManager.updateSchedule(chatflowId, scheduleConfig)

        return res.json(updatedChatflow)
    } catch (error) {
        next(error)
    }
}

const getChatflowSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getChatflowSchedule - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const chatflow = await chatflowsService.getChatflowById(chatflowId)

        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        const scheduleConfig = chatflow.scheduleConfig ? JSON.parse(chatflow.scheduleConfig) : null

        return res.json({
            chatflowId: chatflow.id,
            scheduleEnabled: chatflow.scheduleEnabled || false,
            scheduleConfig
        })
    } catch (error) {
        next(error)
    }
}

const enableChatflowSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.enableChatflowSchedule - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const chatflow = await chatflowsService.getChatflowById(chatflowId)

        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Error: Cannot enable schedule for global resources`)
        }

        if (!chatflow.scheduleConfig) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Error: No schedule configuration found for this chatflow`)
        }

        const scheduleManager = ScheduleManager.getInstance()
        await scheduleManager.enableSchedule(chatflowId)

        return res.json({ message: 'Schedule enabled successfully', chatflowId })
    } catch (error) {
        next(error)
    }
}

const disableChatflowSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.disableChatflowSchedule - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const chatflow = await chatflowsService.getChatflowById(chatflowId)

        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Error: Cannot disable schedule for global resources`)
        }

        const scheduleManager = ScheduleManager.getInstance()
        await scheduleManager.disableSchedule(chatflowId)

        return res.json({ message: 'Schedule disabled successfully', chatflowId })
    } catch (error) {
        next(error)
    }
}

const getAllScheduledChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const scheduleManager = ScheduleManager.getInstance()
        const scheduledFlows = await scheduleManager.getScheduledFlows()

        // Filter by workspace if user has one
        const workspaceId = req.user?.activeWorkspaceId
        const filteredFlows = workspaceId ? scheduledFlows.filter((flow) => flow.workspaceId === workspaceId) : scheduledFlows

        // Apply room isolation
        const roomFilteredFlows = req.isRootAdmin
            ? filteredFlows
            : filteredFlows.filter((flow) => !flow.roomId || flow.roomId === req.roomId)

        return res.json(roomFilteredFlows)
    } catch (error) {
        next(error)
    }
}

const getAllBots = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get all chatflows with botEnabled = true
        const bots = await chatflowsService.getAllBotEnabledChatflows()

        // Filter by workspace if user has one
        const workspaceId = req.user?.activeWorkspaceId
        const filteredBots = workspaceId ? bots.filter((bot) => bot.workspaceId === workspaceId) : bots

        // Apply room isolation
        const roomFilteredBots = req.isRootAdmin ? filteredBots : filteredBots.filter((bot) => !bot.roomId || bot.roomId === req.roomId)

        return res.json(roomFilteredBots)
    } catch (error) {
        next(error)
    }
}

const updateBotEnabled = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.updateBotEnabled - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const { enabled } = req.body

        const chatflow = await chatflowsService.getChatflowById(chatflowId)
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Error: Cannot modify bot config for global resources`)
        }

        // Update botEnabled field
        chatflow.botEnabled = enabled || false

        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Organization not found`)
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Workspace not found`)
        }

        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''

        const updatedChatflow = await chatflowsService.updateChatflow(chatflow, chatflow, orgId, workspaceId, subscriptionId)

        return res.json({ message: 'Bot configuration updated successfully', chatflowId, botEnabled: updatedChatflow.botEnabled })
    } catch (error) {
        next(error)
    }
}

// SUBAGENT MANAGEMENT

const getAllSubAgents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get all chatflows with subAgentEnabled = true
        const subAgents = await chatflowsService.getAllSubAgentEnabledChatflows()

        // Filter by workspace if user has one
        const workspaceId = req.user?.activeWorkspaceId
        const filteredSubAgents = workspaceId ? subAgents.filter((subAgent) => subAgent.workspaceId === workspaceId) : subAgents

        // Apply room isolation
        const roomFilteredSubAgents = req.isRootAdmin
            ? filteredSubAgents
            : filteredSubAgents.filter((subAgent) => !subAgent.roomId || subAgent.roomId === req.roomId)

        return res.json(roomFilteredSubAgents)
    } catch (error) {
        next(error)
    }
}

const updateSubAgentEnabled = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.updateSubAgentEnabled - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const { enabled } = req.body

        const chatflow = await chatflowsService.getChatflowById(chatflowId)
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Error: Cannot modify subagent config for global resources`)
        }

        // Update subAgentEnabled field
        chatflow.subAgentEnabled = enabled || false

        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Organization not found`)
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Workspace not found`)
        }

        const subscriptionId = req.user?.activeOrganizationSubscriptionId || ''

        const updatedChatflow = await chatflowsService.updateChatflow(chatflow, chatflow, orgId, workspaceId, subscriptionId)

        return res.json({
            message: 'SubAgent configuration updated successfully',
            chatflowId,
            subAgentEnabled: updatedChatflow.subAgentEnabled
        })
    } catch (error) {
        next(error)
    }
}

const updateChatflowFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.updateChatflowFolder - chatflow id not provided!`
            )
        }

        const chatflowId = req.params.id
        const { folderId } = req.body

        const chatflow = await chatflowsService.getChatflowById(chatflowId)
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Room isolation check
        if (!req.isRootAdmin && req.roomId && !chatflow.roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, `Error: Cannot modify folder for global resources`)
        }

        // Update folder
        const updatedChatflow = await chatflowsService.updateChatflowFolder(chatflowId, folderId ?? null)

        return res.json({
            message: 'Chatflow folder updated successfully',
            chatflowId,
            folderId: updatedChatflow.folderId
        })
    } catch (error) {
        next(error)
    }
}

// Schedule Monitoring Endpoints

const getScheduleMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsController.getScheduleMetrics - id not provided!`
            )
        }

        const chatflowId = req.params.id
        const chatflow = await chatflowsService.getChatflowById(chatflowId)

        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Error: Chatflow ${chatflowId} not found`)
        }

        // Get metrics from ScheduleWorker
        const app = getRunningExpressApp()
        const scheduleWorker = app.scheduleWorker

        if (!scheduleWorker) {
            return res.json({
                message: 'Schedule worker not initialized. Make sure MODE=queue is set.',
                metrics: null
            })
        }

        const metricsCollector = scheduleWorker.getMetricsCollector()
        const metrics = metricsCollector.getChatflowMetrics(chatflowId)
        const successRate = metricsCollector.getSuccessRate(chatflowId)

        return res.json({
            chatflowId,
            metrics: metrics || null,
            successRate: successRate.toFixed(2) + '%'
        })
    } catch (error) {
        next(error)
    }
}

const getGlobalScheduleMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get metrics from ScheduleWorker
        const app = getRunningExpressApp()
        const scheduleWorker = app.scheduleWorker

        if (!scheduleWorker) {
            return res.json({
                message: 'Schedule worker not initialized. Make sure MODE=queue is set.',
                metrics: null
            })
        }

        const metricsCollector = scheduleWorker.getMetricsCollector()
        const globalMetrics = metricsCollector.getGlobalMetrics()
        const successRate = metricsCollector.getGlobalSuccessRate()
        const allMetrics = metricsCollector.getAllMetrics()

        // Convert Map to object for JSON serialization
        const perChatflowMetrics: Record<string, any> = {}
        allMetrics.forEach((metrics, chatflowId) => {
            perChatflowMetrics[chatflowId] = {
                ...metrics,
                successRate: metricsCollector.getSuccessRate(chatflowId).toFixed(2) + '%'
            }
        })

        return res.json({
            globalMetrics,
            globalSuccessRate: successRate.toFixed(2) + '%',
            perChatflowMetrics
        })
    } catch (error) {
        next(error)
    }
}

const getScheduleHealth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const scheduleManager = ScheduleManager.getInstance()
        const healthStatus = await scheduleManager.getHealthStatus()

        return res.json(healthStatus)
    } catch (error) {
        next(error)
    }
}

const getScheduleQueueStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const scheduleManager = ScheduleManager.getInstance()
        const queueStats = await scheduleManager.getQueueStats()

        return res.json(queueStats)
    } catch (error) {
        next(error)
    }
}

// Helper function to validate cron expression
function isValidCronExpression(expression: string): boolean {
    // Basic cron expression validation (5 or 6 fields)
    const cronRegex =
        /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))( (\*|([0-9]{4})))?$/
    return cronRegex.test(expression)
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    updateChatflow,
    getSinglePublicChatflow,
    getSinglePublicChatbotConfig,
    checkIfChatflowHasChanged,
    updateChatflowSchedule,
    getChatflowSchedule,
    enableChatflowSchedule,
    disableChatflowSchedule,
    getAllScheduledChatflows,
    getScheduleMetrics,
    getGlobalScheduleMetrics,
    getScheduleHealth,
    getScheduleQueueStats,
    getAllBots,
    updateBotEnabled,
    getAllSubAgents,
    updateSubAgentEnabled,
    updateChatflowFolder
}
