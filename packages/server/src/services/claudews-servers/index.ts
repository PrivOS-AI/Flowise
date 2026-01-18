import { StatusCodes } from 'http-status-codes'
import { IsNull } from 'typeorm'
import axios, { AxiosInstance } from 'axios'
import { ClaudeWSServer } from '../../database/entities/ClaudeWSServer'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { encryptCredentialData, decryptCredentialData } from '../../utils'

/**
 * Create a new ClaudeWS server
 */
const createServer = async (
    data: any,
    userId: string,
    workspaceId?: string,
    roomId?: string,
    isRootAdmin?: boolean
): Promise<ClaudeWSServer> => {
    try {
        const appServer = getRunningExpressApp()

        // Encrypt API key before storing
        const encryptedApiKey = await encryptCredentialData({ apiKey: data.apiKey })

        const newServer = new ClaudeWSServer()
        Object.assign(newServer, {
            ...data,
            apiKey: encryptedApiKey,
            workspaceId,
            roomId: isRootAdmin ? data.roomId : roomId // Root admin can assign any room, users use their own
        })

        const server = await appServer.AppDataSource.getRepository(ClaudeWSServer).create(newServer)
        const dbResponse = await appServer.AppDataSource.getRepository(ClaudeWSServer).save(server)

        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.createServer - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all ClaudeWS servers with room isolation
 */
const getAllServers = async (
    workspaceId?: string,
    roomId?: string,
    isRootAdmin?: boolean,
    page: number = -1,
    limit: number = -1
) => {
    try {
        const appServer = getRunningExpressApp()
        const queryBuilder = appServer.AppDataSource.getRepository(ClaudeWSServer)
            .createQueryBuilder('server')
            .orderBy('server.updatedDate', 'DESC')

        // Workspace isolation
        if (workspaceId) {
            queryBuilder.andWhere('server.workspaceId = :workspaceId', { workspaceId })
        }

        // Room isolation: Root admin sees all, room users see their room + global resources
        if (!isRootAdmin && roomId) {
            queryBuilder.andWhere('(server.roomId = :roomId OR server.roomId IS NULL)', { roomId })
        }

        // Pagination
        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }

        const [data, total] = await queryBuilder.getManyAndCount()

        if (page > 0 && limit > 0) {
            return { data, total }
        } else {
            return data
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.getAllServers - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get ClaudeWS server by ID
 */
const getServerById = async (id: string): Promise<ClaudeWSServer> => {
    try {
        const appServer = getRunningExpressApp()
        const server = await appServer.AppDataSource.getRepository(ClaudeWSServer).findOneBy({ id })

        if (!server) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ClaudeWS Server ${id} not found`)
        }

        return server
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.getServerById - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Update ClaudeWS server with room isolation check
 */
const updateServer = async (
    id: string,
    data: any,
    userId: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<ClaudeWSServer> => {
    try {
        const appServer = getRunningExpressApp()
        const server = await appServer.AppDataSource.getRepository(ClaudeWSServer).findOneBy({ id })

        if (!server) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ClaudeWS Server ${id} not found`)
        }

        // Room isolation check: non-root users cannot edit global resources or other room's resources
        if (!isRootAdmin) {
            if (server.roomId === null) {
                throw new InternalFlowiseError(
                    StatusCodes.FORBIDDEN,
                    'Cannot modify global ClaudeWS server. Only administrators can edit shared resources.'
                )
            }
            if (server.roomId !== roomId) {
                throw new InternalFlowiseError(
                    StatusCodes.FORBIDDEN,
                    'Cannot modify ClaudeWS server from another room'
                )
            }
        }

        // Encrypt API key if provided
        if (data.apiKey) {
            data.apiKey = await encryptCredentialData({ apiKey: data.apiKey })
        }

        const updateData = new ClaudeWSServer()
        Object.assign(updateData, data)

        appServer.AppDataSource.getRepository(ClaudeWSServer).merge(server, updateData)
        const dbResponse = await appServer.AppDataSource.getRepository(ClaudeWSServer).save(server)

        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.updateServer - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete ClaudeWS server with room isolation check
 */
const deleteServer = async (id: string, userId: string, isRootAdmin?: boolean, roomId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const server = await appServer.AppDataSource.getRepository(ClaudeWSServer).findOneBy({ id })

        if (!server) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ClaudeWS Server ${id} not found`)
        }

        // Room isolation check
        if (!isRootAdmin) {
            if (server.roomId === null) {
                throw new InternalFlowiseError(
                    StatusCodes.FORBIDDEN,
                    'Cannot delete global ClaudeWS server. Only administrators can delete shared resources.'
                )
            }
            if (server.roomId !== roomId) {
                throw new InternalFlowiseError(
                    StatusCodes.FORBIDDEN,
                    'Cannot delete ClaudeWS server from another room'
                )
            }
        }

        const dbResponse = await appServer.AppDataSource.getRepository(ClaudeWSServer).delete({ id })
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.deleteServer - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Test connection to ClaudeWS server
 */
const testConnection = async (id: string): Promise<{ success: boolean; message: string; version?: string }> => {
    try {
        const server = await getServerById(id)
        const client = await createClient(server)

        // Try to access a protected endpoint to verify API key
        // Using /api/projects as it requires authentication
        const response = await client.get('/api/projects')

        // If we get here without error, the API key is valid
        return {
            success: true,
            message: 'Connection successful - API key verified'
        }
    } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return {
                success: false,
                message: 'Invalid API key - authentication failed'
            }
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                success: false,
                message: 'Cannot connect to server - check endpoint URL'
            }
        }
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Connection failed'
        }
    }
}

/**
 * Test connection with provided credentials (without saving)
 */
const testConnectionWithCredentials = async (credentials: {
    endpointUrl: string
    apiKey: string
}): Promise<{ success: boolean; message: string; version?: string }> => {
    try {
        const client = axios.create({
            baseURL: credentials.endpointUrl,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': credentials.apiKey
            },
            timeout: 30000
        })

        // Try to access a protected endpoint to verify API key
        // Using /api/projects as it requires authentication
        const response = await client.get('/api/projects')

        // If we get here without error, the API key is valid
        return {
            success: true,
            message: 'Connection successful - API key verified'
        }
    } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return {
                success: false,
                message: 'Invalid API key - authentication failed'
            }
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                success: false,
                message: 'Cannot connect to server - check endpoint URL'
            }
        }
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Connection failed'
        }
    }
}

/**
 * Create axios client for ClaudeWS server
 */
const createClient = async (server: ClaudeWSServer): Promise<AxiosInstance> => {
    try {
        // Decrypt API key
        const decryptedData = await decryptCredentialData(server.apiKey)
        const apiKey = decryptedData.apiKey

        // Remove trailing slash from endpoint URL to prevent double slashes
        const baseURL = server.endpointUrl.replace(/\/$/, '')

        const client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            timeout: 30000 // 30 second timeout
        })

        return client
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsServerService.createClient - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createServer,
    getAllServers,
    getServerById,
    updateServer,
    deleteServer,
    testConnection,
    testConnectionWithCredentials,
    createClient
}
