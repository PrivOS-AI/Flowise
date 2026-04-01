import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'
import { Workspace } from '../../enterprise/database/entities/workspace.entity'

/**
 * AGENT FLOW CREATOR CONTROLLER
 *
 * Create Agent Flows programmatically via API
 * Similar to webhook endpoint - simplified authentication
 */

export const createAgentFlow = async (req: Request, res: Response, _next: NextFunction) => {
    const requestId = uuidv4()

    try {
        logger.info(`[agentflow-creator]: ===== CREATE AGENT FLOW REQUEST =====`)
        logger.info(`[agentflow-creator]: Request ID: ${requestId}`)
        logger.info(`[agentflow-creator]: Body: ${JSON.stringify(req.body)}`)

        const { name, flowData, apiKey, workspaceId: bodyWorkspaceId, roomId: bodyRoomId } = req.body

        // Validate required fields
        if (!name) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Missing required field: name',
                usage: {
                    method: 'POST /api/v1/agentflow-creator',
                    body: {
                        name: 'My Agent Flow',
                        flowData: { nodes: [], edges: [] },
                        roomId: 'optional_room_id  (preferred)',
                        apiKey: 'optional_api_key  (legacy: used as roomId if roomId not provided)',
                        workspaceId: 'optional_workspace_id'
                    }
                }
            })
        }

        if (!flowData || !flowData.nodes || !flowData.edges) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Invalid flowData. Must contain nodes and edges arrays.',
                usage: {
                    method: 'POST /api/v1/agentflow-creator',
                    body: {
                        name: 'My Agent Flow',
                        flowData: {
                            nodes: 'Array of nodes',
                            edges: 'Array of edges'
                        },
                        roomId: 'optional_room_id',
                        workspaceId: 'optional_workspace_id'
                    }
                }
            })
        }

        // ─── Resolve roomId ──────────────────────────────────────────────────────
        // Priority order:
        //   1. body.roomId  (explicit, recommended)
        //   2. body.apiKey  (legacy fallback - previously used as roomId, >= 10 chars)
        //   3. null         → global flow, visible to everyone in the workspace
        //
        // NOTE: In the official saveChatflow, roomId comes from the authenticated user's
        // JWT token (req.roomId). Since agentflow-creator is an external/unauthenticated
        // endpoint, we accept roomId directly from the request body instead.
        let roomId: string | null = null
        if (bodyRoomId && typeof bodyRoomId === 'string' && bodyRoomId.length > 0) {
            roomId = bodyRoomId // ✅ Preferred: explicit roomId field
        } else if (apiKey && typeof apiKey === 'string' && apiKey.length >= 10) {
            roomId = apiKey // ⚠️ Legacy fallback: apiKey used as roomId
            logger.warn(`[agentflow-creator]: Using apiKey as roomId (legacy). Use 'roomId' field instead.`)
        }

        logger.info(`[agentflow-creator]: Creating flow${roomId ? ' for roomId: ' + roomId : ' (global flow)'}`)

        // Get database connection
        const appServer = getRunningExpressApp()
        const AppDataSource = appServer?.AppDataSource

        if (!AppDataSource) {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Database connection not available')
        }

        const chatFlowRepo = AppDataSource.getRepository(ChatFlow)

        // Check if flow with same name exists
        const existingFlow = await chatFlowRepo.findOne({ where: { name } })
        if (existingFlow) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                error: `Flow with name "${name}" already exists`,
                existingId: existingFlow.id
            })
        }

        // ─── Resolve workspaceId ────────────────────────────────────────────────
        // Priority: (1) body.workspaceId, (2) first workspace in DB (auto-detect)
        // Without workspaceId, UI filters it out and the flow is INVISIBLE.
        let resolvedWorkspaceId: string | null = null

        if (bodyWorkspaceId && typeof bodyWorkspaceId === 'string' && bodyWorkspaceId.length > 0) {
            resolvedWorkspaceId = bodyWorkspaceId
            logger.info(`[agentflow-creator]: Using workspaceId from request body: ${resolvedWorkspaceId}`)
        } else {
            // Auto-detect: grab the first available workspace from DB
            try {
                const workspaceRepo = AppDataSource.getRepository(Workspace)
                const firstWorkspace = await workspaceRepo.findOne({
                    where: {},
                    order: { createdDate: 'ASC' }
                })
                if (firstWorkspace) {
                    resolvedWorkspaceId = firstWorkspace.id
                    logger.info(`[agentflow-creator]: Auto-detected workspaceId: ${resolvedWorkspaceId}`)
                } else {
                    logger.warn(`[agentflow-creator]: No workspace found in DB - flow will have NULL workspaceId and may not appear in UI`)
                }
            } catch (wsErr: any) {
                logger.warn(`[agentflow-creator]: Could not auto-detect workspaceId: ${wsErr.message} - flow may not appear in UI`)
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        // Create new ChatFlow entity for Agent Flow
        const newFlow = new ChatFlow()
        newFlow.name = name
        newFlow.flowData = JSON.stringify(flowData)
        newFlow.type = 'AGENTFLOW' as any
        newFlow.deployed = true

        // Set workspaceId so UI can find the flow
        if (resolvedWorkspaceId) {
            newFlow.workspaceId = resolvedWorkspaceId
        }

        // Only add roomId if provided (global flow = no roomId)
        if (roomId) {
            newFlow.roomId = roomId
        }

        // Save to database
        const savedFlow = await chatFlowRepo.save(newFlow)

        logger.info(`[agentflow-creator]: ✅ Agent Flow created successfully (requestId: ${requestId}, flowId: ${savedFlow.id})`)

        return res.status(StatusCodes.CREATED).json({
            success: true,
            flowId: savedFlow.id,
            flowName: savedFlow.name,
            message: 'Agent Flow created successfully',
            // ✅ Correct canvas URL for AGENTFLOW (v2)
            accessUrl: `/v2/agentcanvas/${savedFlow.id}`,
            // URL where the flow appears in the list view
            listUrl: `/agentflows`,
            workspaceId: resolvedWorkspaceId,
            data: {
                id: savedFlow.id,
                name: savedFlow.name,
                flowData: savedFlow.flowData,
                type: savedFlow.type,
                workspaceId: savedFlow.workspaceId
            }
        })
    } catch (error: any) {
        logger.error(`[agentflow-creator]: ❌ Failed to create Agent Flow (requestId: ${requestId}): ${error.message}`)
        logger.error(
            `[agentflow-creator]: Error details: ${JSON.stringify({
                message: error.message,
                code: error.code,
                stack: error.stack
            })}`
        )

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: 'Failed to create Agent Flow',
            message: error.message,
            details: error.stack
        })
    }
}

/**
 * Get all Agent Flows
 * Supports roomId filtering for room isolation (like UI does)
 */
export const getAllAgentFlows = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const { roomId } = req.query // Get roomId from query params

        const appServer = getRunningExpressApp()
        const AppDataSource = appServer?.AppDataSource

        if (!AppDataSource) {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Database connection not available')
        }

        const chatFlowRepo = AppDataSource.getRepository(ChatFlow)

        // Build query with room filter (same logic as chatflowsService.getAllChatflows)
        const queryBuilder = chatFlowRepo
            .createQueryBuilder('chat_flow')
            .where('chat_flow.type = :type', { type: 'AGENTFLOW' })
            .orderBy('chat_flow.updatedDate', 'DESC')

        // Room isolation: if roomId provided, filter flows
        // Same logic as chatflowsService line 181-183:
        // (chat_flow.roomId = :roomId OR chat_flow.roomId IS NULL)
        if (roomId) {
            queryBuilder.andWhere('(chat_flow.roomId = :roomId OR chat_flow.roomId IS NULL)', { roomId })
        }

        const agentFlows = await queryBuilder.getMany()

        return res.json({
            success: true,
            count: agentFlows.length,
            flows: agentFlows.map((flow: any) => ({
                id: flow.id,
                name: flow.name,
                type: flow.type,
                createdDate: flow.createdDate,
                updatedDate: flow.updatedDate,
                roomId: flow.roomId,
                accessUrl: `/agentflow/${flow.id}`
            }))
        })
    } catch (error: any) {
        logger.error(`[agentflow-creator]: Failed to get Agent Flows: ${error.message}`)

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: 'Failed to get Agent Flows',
            message: error.message
        })
    }
}

/**
 * Get Agent Flow by ID
 */
export const getAgentFlowById = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Missing flow ID'
            })
        }

        const appServer = getRunningExpressApp()
        const AppDataSource = appServer?.AppDataSource

        if (!AppDataSource) {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Database connection not available')
        }

        const chatFlowRepo = AppDataSource.getRepository(ChatFlow)

        const flow = await chatFlowRepo.findOne({ where: { id } })

        if (!flow) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: 'Agent Flow not found'
            })
        }

        if (flow.type !== 'AGENTFLOW') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: 'Flow is not an Agent Flow'
            })
        }

        return res.json({
            success: true,
            flow: {
                id: flow.id,
                name: flow.name,
                flowData: flow.flowData,
                type: flow.type,
                createdDate: flow.createdDate,
                updatedDate: flow.updatedDate
            }
        })
    } catch (error: any) {
        logger.error(`[agentflow-creator]: Failed to get Agent Flow: ${error.message}`)

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: 'Failed to get Agent Flow',
            message: error.message
        })
    }
}
