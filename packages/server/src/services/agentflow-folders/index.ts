import { StatusCodes } from 'http-status-codes'
import { AgentflowFolder } from '../../database/entities/AgentflowFolder'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { IAgentflowFolder, IAgentflowFolderInput } from '../../Interface'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

// Get all folders for a workspace, optionally by parentId (null = root folders)
export const getAllFolders = async (workspaceId?: string | null, parentId?: string | null): Promise<IAgentflowFolder[]> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(AgentflowFolder)

        const searchOptions: any = {
            order: { updatedDate: 'DESC' }
        }
        // Build where clause
        const where: any = {}
        if (workspaceId) {
            where.workspaceId = workspaceId
        }
        // Filter by parentId - if null, get root folders; if provided, get subfolders
        if (parentId !== undefined) {
            where.parentId = parentId
        }
        if (Object.keys(where).length > 0) {
            searchOptions.where = where
        }

        const folders = await repository.find(searchOptions)
        return folders
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.getAllFolders - ${getErrorMessage(error)}`
        )
    }
}

// Get subfolders of a specific folder
export const getSubfolders = async (parentId: string): Promise<IAgentflowFolder[]> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(AgentflowFolder)

        const folders = await repository.find({
            where: { parentId },
            order: { updatedDate: 'DESC' }
        })
        return folders
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.getSubfolders - ${getErrorMessage(error)}`
        )
    }
}

// Get folder by ID
export const getFolderById = async (id: string): Promise<IAgentflowFolder> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(AgentflowFolder)

        const folder = await repository.findOne({ where: { id } })
        if (!folder) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Folder ${id} not found`)
        }
        return folder
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.getFolderById - ${getErrorMessage(error)}`
        )
    }
}

// Create new folder
export const createFolder = async (input: IAgentflowFolderInput): Promise<IAgentflowFolder> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(AgentflowFolder)

        const folder = repository.create(input)
        const savedFolder = await repository.save(folder)
        return savedFolder
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.createFolder - ${getErrorMessage(error)}`
        )
    }
}

// Update folder
export const updateFolder = async (id: string, input: Partial<IAgentflowFolderInput>): Promise<IAgentflowFolder> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(AgentflowFolder)

        const folder = await repository.findOne({ where: { id } })
        if (!folder) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Folder ${id} not found`)
        }
        Object.assign(folder, input)
        const savedFolder = await repository.save(folder)
        return savedFolder
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.updateFolder - ${getErrorMessage(error)}`
        )
    }
}

// Delete folder (sets agentflows folderId to null, and deletes subfolders recursively)
export const deleteFolder = async (id: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        const folderRepository = appServer.AppDataSource.getRepository(AgentflowFolder)
        const chatflowRepository = appServer.AppDataSource.getRepository(ChatFlow)

        const folder = await folderRepository.findOne({ where: { id } })
        if (!folder) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Folder ${id} not found`)
        }

        // Recursively delete subfolders
        const subfolders = await getSubfolders(id)
        for (const subfolder of subfolders) {
            await deleteFolder(subfolder.id)
        }

        // Set all agentflows in this folder to null
        await chatflowRepository.update({ folderId: id }, { folderId: undefined })

        // Delete the folder
        await folderRepository.delete({ id })
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.deleteFolder - ${getErrorMessage(error)}`
        )
    }
}

// Get agentflows count in folder
export const getFolderAgentflowsCount = async (folderId: string): Promise<number> => {
    try {
        const appServer = getRunningExpressApp()
        const repository = appServer.AppDataSource.getRepository(ChatFlow)

        const count = await repository.count({ where: { folderId } })
        return count
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: agentflowFoldersService.getFolderAgentflowsCount - ${getErrorMessage(error)}`
        )
    }
}
