import { StatusCodes } from 'http-status-codes'
import axios, { AxiosInstance } from 'axios'
import { ClaudeWSServer } from '../../database/entities/ClaudeWSServer'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { encryptCredentialData, decryptCredentialData, getEncryptionKey } from '../../utils'

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

        // Check if API key is already encrypted (starts with U2FsdGVkX1 which is "Salted__" in base64)
        // CryptoJS AES encrypted strings start with this prefix
        const isAlreadyEncrypted = data.apiKey && typeof data.apiKey === 'string' && data.apiKey.startsWith('U2FsdGVkX1')

        let encryptedApiKey
        if (isAlreadyEncrypted) {
            console.log('[ClaudeWS Server] API key appears already encrypted, skipping encryption')
            encryptedApiKey = data.apiKey
        } else {
            console.log('[ClaudeWS Server] Encrypting API key before storage')
            encryptedApiKey = await encryptCredentialData({ apiKey: data.apiKey })
        }

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
const getAllServers = async (workspaceId?: string, roomId?: string, isRootAdmin?: boolean, page: number = -1, limit: number = -1) => {
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
const updateServer = async (id: string, data: any, userId: string, isRootAdmin?: boolean, roomId?: string): Promise<ClaudeWSServer> => {
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
                throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot modify ClaudeWS server from another room')
            }
        }

        // Encrypt API key if provided
        if (data.apiKey) {
            // Check if API key is already encrypted
            const isAlreadyEncrypted = typeof data.apiKey === 'string' && data.apiKey.startsWith('U2FsdGVkX1')
            if (isAlreadyEncrypted) {
                console.log('[ClaudeWS Server] Update: API key appears already encrypted, skipping encryption')
            } else {
                console.log('[ClaudeWS Server] Update: Encrypting new API key')
                data.apiKey = await encryptCredentialData({ apiKey: data.apiKey })
            }
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
                throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot delete ClaudeWS server from another room')
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
        // Debug: log raw encrypted data (first 50 chars)
        console.log('[ClaudeWS Client] Raw encrypted data:', server.apiKey.substring(0, 50) + '...')

        // Decrypt API key
        let decryptedData = await decryptCredentialData(server.apiKey)
        console.log('[ClaudeWS Client] First decryption - keys:', Object.keys(decryptedData))

        let apiKey = decryptedData.apiKey
        console.log('[ClaudeWS Client] Extracted API key after first decrypt:', apiKey ? apiKey.substring(0, 10) + '...' : 'UNDEFINED')

        // Handle double-encryption case: if API key still looks encrypted, decrypt again
        if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('U2FsdGVkX1')) {
            console.log('[ClaudeWS Client] API key still appears encrypted, attempting second decryption...')
            try {
                // Treat the string as directly encrypted (not wrapped in an object)
                const encryptKey = await getEncryptionKey()
                const AES = require('crypto-js/aes')
                const encUtf8 = require('crypto-js/enc-utf8')
                const decrypted = AES.decrypt(apiKey, encryptKey)
                const decryptedStr = decrypted.toString(encUtf8)

                if (decryptedStr && !decryptedStr.startsWith('U2FsdGVkX1')) {
                    apiKey = decryptedStr
                    console.log('[ClaudeWS Client] Second decryption successful, API key:', apiKey.substring(0, 10) + '...')
                } else {
                    console.log('[ClaudeWS Client] Second decryption did not help, API key may be invalid')
                }
            } catch (secondError) {
                console.error('[ClaudeWS Client] Second decryption failed:', secondError)
            }
        }

        // Remove trailing slash from endpoint URL to prevent double slashes
        const baseURL = server.endpointUrl.replace(/\/$/, '')

        console.log('[ClaudeWS Client] Creating axios client with:')
        console.log('[ClaudeWS Client]   baseURL:', baseURL)
        console.log('[ClaudeWS Client]   x-api-key:', apiKey.substring(0, 10) + '...')
        console.log('[ClaudeWS Client]   timeout: 30000ms')

        const client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            timeout: 120000 // 120 seconds for upload operations
        })

        // Add request interceptor for debugging
        client.interceptors.request.use((config) => {
            console.log('[ClaudeWS HTTP Request]')
            console.log('  Method:', config.method?.toUpperCase() || 'GET')
            console.log('  URL:', (config.baseURL || '') + (config.url || ''))
            console.log(
                '  Headers:',
                JSON.stringify(
                    {
                        'content-type': config.headers['Content-Type'],
                        'x-api-key': config.headers['x-api-key']
                            ? String(config.headers['x-api-key']).substring(0, 10) + '...'
                            : 'undefined'
                    },
                    null,
                    2
                )
            )
            if (config.data) {
                if (config.data instanceof FormData) {
                    console.log('  Body: <FormData with boundaries>')
                } else {
                    console.log('  Body:', JSON.stringify(config.data, null, 2))
                }
            }
            return config
        })

        // Add response interceptor for debugging
        client.interceptors.response.use((response) => {
            console.log('[ClaudeWS HTTP Response]')
            console.log('  Status:', response.status)
            console.log('  Headers:', JSON.stringify(response.headers, null, 2))
            console.log('  Data:', JSON.stringify(response.data, null, 2))
            return response
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
