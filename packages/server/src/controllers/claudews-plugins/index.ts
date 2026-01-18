import { NextFunction, Request, Response } from 'express'
import claudewsPluginService from '../../services/claudews-plugins'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const listPlugins = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.listPlugins - serverId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId
        const type = req.query?.type as string | undefined

        const apiResponse = await claudewsPluginService.listPlugins(req.params.serverId, type, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getPlugin - serverId or pluginId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.getPlugin(req.params.serverId, req.params.pluginId, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const discoverPlugins = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.discoverPlugins - serverId not provided!`
            )
        }

        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        // Accept empty paths (send empty array to ClaudeWS for default discovery)
        const paths = req.body?.paths || []

        const apiResponse = await claudewsPluginService.discoverPlugins(req.params.serverId, paths, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const uploadPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.uploadPlugin - serverId not provided!`
            )
        }

        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        // Check if this is a confirmation request (JSON with sessionId)
        if (req.body && req.body.sessionId && req.body.confirm) {
            console.log('[ClaudeWS] Confirmation request with sessionId:', req.body.sessionId)
            const apiResponse = await claudewsPluginService.confirmUpload(req.params.serverId, req.body.sessionId, userId, isRootAdmin, roomId)
            return res.json(apiResponse)
        }

        // Otherwise, handle file upload
        // Debug logging
        console.log('[ClaudeWS] Upload request - req.files:', req.files)
        console.log('[ClaudeWS] Upload request - req.file:', (req as any).file)
        console.log('[ClaudeWS] Upload request - req.body:', req.body)
        console.log('[ClaudeWS] Upload request - content-type:', req.headers['content-type'])

        console.log('[ClaudeWS] Validation - req.files exists:', !!req.files)
        console.log('[ClaudeWS] Validation - is array:', Array.isArray(req.files))
        console.log('[ClaudeWS] Validation - length:', req.files ? (req.files as any).length : 0)

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            console.log('[ClaudeWS] Validation FAILED!')
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.uploadPlugin - files not provided!`
            )
        }
        console.log('[ClaudeWS] Validation PASSED! Calling service...')

        const apiResponse = await claudewsPluginService.uploadPlugin(req.params.serverId, req.files, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const importPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.importPlugin - serverId not provided!`
            )
        }
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.importPlugin - body not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.importPlugin(req.params.serverId, req.body, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deletePlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.deletePlugin - serverId or pluginId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.deletePlugin(req.params.serverId, req.params.pluginId, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const listPluginFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.listPluginFiles - serverId or pluginId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.listPluginFiles(req.params.serverId, req.params.pluginId, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getPluginFileContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getPluginFileContent - serverId or pluginId not provided!`
            )
        }

        // Get file path from wildcard route parameter
        const filePath = req.params[0] || req.params.filePath
        if (!filePath) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getPluginFileContent - filePath not provided!`
            )
        }

        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        // Decode the file path (it comes URL encoded)
        const decodedFilePath = decodeURIComponent(filePath)

        const apiResponse = await claudewsPluginService.getPluginFileContent(
            req.params.serverId,
            req.params.pluginId,
            decodedFilePath,
            userId,
            isRootAdmin,
            roomId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getPluginDependencies = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getPluginDependencies - serverId or pluginId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.getPluginDependencies(req.params.serverId, req.params.pluginId, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const installDependency = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId || !req.params.pluginId || !req.params.depId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.installDependency - serverId, pluginId, or depId not provided!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.installDependency(req.params.serverId, req.params.pluginId, req.params.depId, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getFileContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getFileContent - serverId not provided!`
            )
        }
        if (!req.body || !req.body.path) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getFileContent - path not provided in body!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.getFileContent(req.params.serverId, req.body.path, userId, isRootAdmin, roomId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getDependenciesFromSource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getDependenciesFromSource - serverId not provided!`
            )
        }
        if (!req.body || !req.body.sourcePath) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.getDependenciesFromSource - sourcePath not provided in body!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.getDependenciesFromSource(
            req.params.serverId,
            req.body.sourcePath,
            req.body.type,
            userId,
            isRootAdmin,
            roomId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const listFilesFromSource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.serverId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.listFilesFromSource - serverId not provided!`
            )
        }
        if (!req.body || !req.body.sourcePath) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: claudewsPluginController.listFilesFromSource - sourcePath not provided in body!`
            )
        }
        const userId = req.user?.id
        const isRootAdmin = req.isRootAdmin || false
        const roomId = req.roomId

        const apiResponse = await claudewsPluginService.listFilesFromSource(
            req.params.serverId,
            req.body.sourcePath,
            userId,
            isRootAdmin,
            roomId
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    listPlugins,
    getPlugin,
    discoverPlugins,
    uploadPlugin,
    importPlugin,
    deletePlugin,
    listPluginFiles,
    getPluginFileContent,
    getPluginDependencies,
    installDependency,
    getFileContent,
    listFilesFromSource,
    getDependenciesFromSource
}
