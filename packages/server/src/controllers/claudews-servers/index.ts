import { NextFunction, Request, Response } from 'express'
import claudewsServerService from '../../services/claudews-servers'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const createServer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: claudewsServerController.createServer - body not provided!`)
        }
        const orgId = req.user?.activeOrganizationId
        if (!orgId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: claudewsServerController.createServer - organization ${orgId} not found!`
            )
        }
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: claudewsServerController.createServer - workspace ${workspaceId} not found!`
            )
        }
        const body = req.body
        body.workspaceId = workspaceId
        const userId = req.user?.id || orgId
        const roomId = req.roomId
        const isRootAdmin = req.isRootAdmin || false

        const apiResponse = await claudewsServerService.createServer(body, userId, workspaceId, roomId, isRootAdmin)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllServers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        const roomId = req.roomId
        const isRootAdmin = req.isRootAdmin || false
        const page = req.query?.page ? parseInt(req.query.page as string) : -1
        const limit = req.query?.limit ? parseInt(req.query.limit as string) : -1

        const apiResponse = await claudewsServerService.getAllServers(workspaceId, roomId, isRootAdmin, page, limit)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getServerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: claudewsServerController.getServerById - id not provided!`)
        }
        const apiResponse = await claudewsServerService.getServerById(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateServer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: claudewsServerController.updateServer - id not provided!`)
        }
        if (!req.body) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: claudewsServerController.updateServer - body not provided!`)
        }

        const userId = req.user?.id || req.user?.activeOrganizationId || ''
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsServerService.updateServer(req.params.id, req.body, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteServer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: claudewsServerController.deleteServer - id not provided!`)
        }

        const userId = req.user?.id || req.user?.activeOrganizationId || ''
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsServerService.deleteServer(req.params.id, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const testConnection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsServerController.testConnection - id not provided!`
            )
        }
        const apiResponse = await claudewsServerService.testConnection(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const testConnectionWithCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('[ClaudeWS] Test connection request body:', JSON.stringify(req.body, null, 2))
        const apiResponse = await claudewsServerService.testConnectionWithCredentials(req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createServer,
    getAllServers,
    getServerById,
    updateServer,
    deleteServer,
    testConnection,
    testConnectionWithCredentials
}
