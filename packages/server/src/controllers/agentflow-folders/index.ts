import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import * as agentflowFoldersService from '../../services/agentflow-folders'

const getAllFolders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parentId = req.query.parentId as string | null | undefined
        const apiResponse = await agentflowFoldersService.getAllFolders(req.user?.activeWorkspaceId ?? null, parentId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getFolderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.getFolderById - id not provided!`
            )
        }
        const apiResponse = await agentflowFoldersService.getFolderById(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const createFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body || !req.body.name) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.createFolder - name not provided!`
            )
        }
        // Workspace is optional - folders can exist without workspace
        const apiResponse = await agentflowFoldersService.createFolder({
            name: req.body.name,
            workspaceId: req.user?.activeWorkspaceId ?? null,
            parentId: req.body.parentId ?? null
        })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.updateFolder - id not provided!`
            )
        }
        if (!req.body || !req.body.name) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.updateFolder - name not provided!`
            )
        }
        const apiResponse = await agentflowFoldersService.updateFolder(req.params.id, { name: req.body.name })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.deleteFolder - id not provided!`
            )
        }
        await agentflowFoldersService.deleteFolder(req.params.id)
        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

const moveChatflowToFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: agentflowFoldersController.moveChatflowToFolder - chatflow id not provided!`
            )
        }
        const { folderId } = req.body
        // Import here to avoid circular dependency
        const chatflowsService = require('../../services/chatflows')
        const apiResponse = await chatflowsService.default.updateChatflowFolder(req.params.id, folderId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const agentflowsController = {
    getAllFolders,
    getFolderById,
    createFolder,
    updateFolder,
    deleteFolder,
    moveChatflowToFolder
}

export default agentflowsController
