import { StatusCodes } from 'http-status-codes'
import { ClaudeWSPlugin } from '../../database/entities/ClaudeWSPlugin'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import claudewsServerService from '../claudews-servers'

/**
 * List all plugins from ClaudeWS server with optional type filter
 */
const listPlugins = async (serverId: string, type?: string, _userId?: string, isRootAdmin?: boolean, roomId?: string): Promise<any[]> => {
    try {
        console.log('[ClaudeWS] listPlugins called with serverId:', serverId, 'type:', type)

        // Check server access (room isolation)
        const server = await claudewsServerService.getServerById(serverId)
        console.log('[ClaudeWS] Server loaded:', { id: server.id, endpointUrl: server.endpointUrl })

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access plugins from another room')
        }

        console.log('[ClaudeWS] Creating client...')
        const client = await claudewsServerService.createClient(server)
        const url = type ? `/api/agent-factory/plugins?type=${type}` : '/api/agent-factory/plugins'

        const fullUrl = server.endpointUrl + url
        console.log('[ClaudeWS] Full URL:', fullUrl)
        console.log('[ClaudeWS] Requesting:', server.endpointUrl + url)

        // Get request config for debugging
        const apiKey = client.defaults.headers['x-api-key']
        const maskedApiKey = apiKey && typeof apiKey === 'string' ? '***' + apiKey.slice(-4) : 'missing'

        const requestConfig = {
            method: 'GET',
            url: url,
            baseURL: client.defaults.baseURL,
            fullURL: client.defaults.baseURL + url,
            headers: {
                'Content-Type': client.defaults.headers['Content-Type'],
                'x-api-key': maskedApiKey
            }
        }

        console.log('[ClaudeWS] Request config:', requestConfig)

        const response = await client.get(url)
        console.log('[ClaudeWS] Response status:', response.status)
        console.log('[ClaudeWS] Response data:', JSON.stringify(response.data).substring(0, 200))

        // Return plugins with debug info
        const plugins = response.data?.plugins || []
        return plugins as any
    } catch (error: any) {
        // Build detailed error info
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message,
            requestedURL: error.config?.url,
            baseURL: error.config?.baseURL,
            fullURL: error.config?.baseURL + error.config?.url,
            responseStatus: error.response?.status,
            responseStatusText: error.response?.statusText,
            responseData: error.response?.data
        }

        console.error('[ClaudeWS] Error in listPlugins:', errorInfo)

        if (error instanceof InternalFlowiseError) throw error

        // Handle connection errors (server unreachable)
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            console.warn(`[ClaudeWS] Connection failed (${error.code}): returning empty list.`)
            return []
        }

        // Handle HTTP errors from reverse proxy / ngrok when upstream server is offline
        // (e.g. ngrok returns 404/502/503 when the target is down)
        if (error.response?.status) {
            const status = error.response.status
            console.warn(`[ClaudeWS] Server returned HTTP ${status} — server may be offline. Returning empty list.`)
            return []
        }

        // Include debug info in error message
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.listPlugins - ${getErrorMessage(error)} | DEBUG: ${JSON.stringify(errorInfo)}`
        )
    }
}

/**
 * Get specific plugin details from ClaudeWS server
 */
const getPlugin = async (serverId: string, pluginId: string, _userId?: string, isRootAdmin?: boolean, roomId?: string): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access plugin from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.get(`/api/agent-factory/plugins/${pluginId}`)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        if (error.response?.status === StatusCodes.NOT_FOUND) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Plugin ${pluginId} not found`)
        }
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.getPlugin - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Discover plugins from specified paths on ClaudeWS server
 */
const discoverPlugins = async (
    serverId: string,
    paths: string[],
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check - only allow if user has access to server
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot discover plugins on server from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.post('/api/agent-factory/discover', { paths })

        // Sync discovered plugins to cache
        await syncPluginCache(serverId)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.discoverPlugins - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Upload plugin files to ClaudeWS server
 */
const uploadPlugin = async (serverId: string, files: any[], _userId?: string, isRootAdmin?: boolean, roomId?: string): Promise<any> => {
    try {
        console.log('[ClaudeWS] uploadPlugin service called with', files.length, 'files')

        // Check server access
        const server = await claudewsServerService.getServerById(serverId)
        console.log('[ClaudeWS] Server retrieved:', server.endpointUrl)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot upload plugin to server from another room')
        }

        const client = await claudewsServerService.createClient(server)
        console.log('[ClaudeWS] Client created')

        // Create FormData for file upload
        const FormData = require('form-data')
        const fs = require('fs')
        const formData = new FormData()

        // Add dryRun parameter for preview mode
        formData.append('dryRun', 'true')

        for (const file of files) {
            console.log(
                '[ClaudeWS] Processing file:',
                file.originalname,
                'has path:',
                !!file.path,
                'has buffer:',
                !!file.buffer,
                'has location:',
                !!file.location
            )

            // Use file.path for disk storage
            if (file.path) {
                console.log('[ClaudeWS] Creating read stream from:', file.path)
                formData.append('file', fs.createReadStream(file.path), file.originalname)
            }
            // Use file.buffer for memory storage
            else if (file.buffer) {
                console.log('[ClaudeWS] Using file buffer')
                formData.append('file', file.buffer, file.originalname)
            }
            // Download from S3/MinIO location URL
            else if (file.location) {
                console.log('[ClaudeWS] Downloading file from S3/MinIO:', file.location)
                try {
                    const axios = require('axios')
                    const fileResponse = await axios.get(file.location, {
                        responseType: 'arraybuffer',
                        validateStatus: (status: number) => status < 500
                    })

                    if (fileResponse.status !== 200) {
                        throw new Error(`S3/MinIO returned status ${fileResponse.status}`)
                    }

                    console.log('[ClaudeWS] Downloaded file size:', fileResponse.data.byteLength, 'bytes')
                    formData.append('file', Buffer.from(fileResponse.data), file.originalname)
                } catch (downloadError: any) {
                    console.error('[ClaudeWS] Failed to download file from S3/MinIO:', {
                        message: downloadError.message,
                        code: downloadError.code,
                        status: downloadError.response?.status
                    })
                    throw new Error(`Failed to download file from storage: ${downloadError.response?.status || downloadError.message}`)
                }
            } else {
                console.error('[ClaudeWS] No valid file source found for:', file.originalname)
                throw new Error(`File ${file.originalname} has no path, buffer, or location`)
            }
        }

        console.log('[ClaudeWS] Posting to /api/agent-factory/upload with dryRun=true...')
        const formHeaders = formData.getHeaders()
        console.log('[ClaudeWS] FormData boundaries:', formHeaders)

        // Override the axios instance default `Content-Type: application/json` with the
        // multipart content-type (including boundary). Setting both the pascal-case and
        // lowercase keys ensures the default is replaced regardless of header casing.
        const response = await client.post('/api/agent-factory/upload', formData, {
            headers: {
                ...formHeaders,
                'Content-Type': formHeaders['content-type']
            },
            maxRedirects: 0,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        })
        console.log('[ClaudeWS] Upload response status:', response.status)
        console.log('[ClaudeWS] Upload response data:', response.data)

        // Sync plugin cache after upload
        await syncPluginCache(serverId)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.uploadPlugin - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Confirm upload after dry-run with sessionId
 */
const confirmUpload = async (
    serverId: string,
    sessionId: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        console.log('[ClaudeWS] confirmUpload called with sessionId:', sessionId)

        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot confirm upload to server from another room')
        }

        const client = await claudewsServerService.createClient(server)

        // Send confirmation to the upload endpoint
        const requestBody = {
            sessionId,
            confirm: true
        }
        console.log('[ClaudeWS] Posting confirmation to /api/agent-factory/upload')
        console.log('[ClaudeWS] Request body:', JSON.stringify(requestBody, null, 2))
        console.log('[ClaudeWS] Request headers:', JSON.stringify(client.defaults.headers, null, 2))

        const response = await client.post('/api/agent-factory/upload', requestBody)

        console.log('[ClaudeWS] Confirmation response:', response.status, response.data)

        // Sync plugin cache after upload confirmation
        await syncPluginCache(serverId)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.confirmUpload - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Import plugin from local file system to ClaudeWS server
 * This imports skills/commands/agents from local paths into the Agent Factory
 */
const importPlugin = async (
    serverId: string,
    data: {
        type: 'skill' | 'command' | 'agent'
        name: string
        description?: string
        sourcePath: string
        metadata?: Record<string, unknown>
    },
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        console.log('[ClaudeWS] importPlugin called with:', { type: data.type, name: data.name, sourcePath: data.sourcePath })

        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot import plugin to server from another room')
        }

        const client = await claudewsServerService.createClient(server)

        // Use the correct endpoint: /api/agent-factory/import (not /api/agent-factory/plugins/import)
        console.log('[ClaudeWS] Calling POST /api/agent-factory/import')
        const response = await client.post('/api/agent-factory/import', data)
        console.log('[ClaudeWS] Import response:', response.status, response.data)

        // Sync plugin cache after import
        await syncPluginCache(serverId)

        return response.data
    } catch (error: any) {
        console.error('[ClaudeWS] importPlugin error:', error.message)

        if (error instanceof InternalFlowiseError) throw error

        // Handle specific error cases
        if (error.response?.status === 404) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Source path not found: ${data.sourcePath}`)
        }
        if (error.response?.status === 409) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, `Plugin with name '${data.name}' already exists`)
        }

        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.importPlugin - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete plugin from ClaudeWS server
 */
const deletePlugin = async (serverId: string, pluginId: string, _userId?: string, isRootAdmin?: boolean, roomId?: string): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot delete plugin from server in another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.delete(`/api/agent-factory/plugins/${pluginId}`)

        // Sync plugin cache after deletion
        await syncPluginCache(serverId)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        if (error.response?.status === 404) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Plugin ${pluginId} not found`)
        }
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.deletePlugin - ${getErrorMessage(error)}`
        )
    }
}

/**
 * List files in a plugin
 */
const listPluginFiles = async (
    serverId: string,
    pluginId: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any[]> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access plugin files from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.get(`/api/agent-factory/plugins/${pluginId}/files`)

        return response.data?.files || []
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.listPluginFiles - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get file content from a plugin
 */
const getPluginFileContent = async (
    serverId: string,
    pluginId: string,
    filePath: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access plugin file from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
        const response = await client.get(`/api/agent-factory/plugins/${pluginId}/files/${encodedPath}`)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.getPluginFileContent - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get plugin dependencies
 */
const getPluginDependencies = async (
    serverId: string,
    pluginId: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access plugin dependencies from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.get(`/api/agent-factory/plugins/${pluginId}/dependencies`)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.getPluginDependencies - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Install a dependency for a plugin
 */
const installDependency = async (
    serverId: string,
    pluginId: string,
    depId: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot install dependency on server from another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.post(`/api/agent-factory/plugins/${pluginId}/dependencies/${depId}/install`)

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.installDependency - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get file content from absolute path (for discovered plugins)
 */
const getFileContent = async (
    serverId: string,
    filePath: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access files from server in another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.post('/api/agent-factory/file-content', { path: filePath })

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.getFileContent - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get dependencies from source path (for discovered plugins)
 */
const getDependenciesFromSource = async (
    serverId: string,
    sourcePath: string,
    type: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access dependencies from server in another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.post('/api/agent-factory/dependencies', { sourcePath, type })

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.getDependenciesFromSource - ${getErrorMessage(error)}`
        )
    }
}

/**
 * List files from source path (for discovered plugins)
 */
const listFilesFromSource = async (
    serverId: string,
    sourcePath: string,
    _userId?: string,
    isRootAdmin?: boolean,
    roomId?: string
): Promise<any> => {
    try {
        // Check server access
        const server = await claudewsServerService.getServerById(serverId)

        // Room isolation check
        if (!isRootAdmin && server.roomId !== null && server.roomId !== roomId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Cannot access files from server in another room')
        }

        const client = await claudewsServerService.createClient(server)
        const response = await client.post('/api/agent-factory/files/list', { sourcePath })

        return response.data
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.listFilesFromSource - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Sync plugin cache from ClaudeWS server to local database
 */
const syncPluginCache = async (serverId: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        const server = await claudewsServerService.getServerById(serverId)
        const client = await claudewsServerService.createClient(server)

        // Fetch all plugins from server
        const response = await client.get('/api/agent-factory/plugins')
        const plugins = response.data?.plugins || []

        // Clear existing cache for this server
        await appServer.AppDataSource.getRepository(ClaudeWSPlugin).delete({ serverId })

        // Insert new cache entries
        const pluginEntities = plugins.map((plugin: any) => {
            const entity = new ClaudeWSPlugin()
            entity.serverId = serverId
            entity.pluginId = plugin.id
            entity.type = plugin.type
            entity.name = plugin.name
            entity.description = plugin.description || ''
            entity.sourcePath = plugin.sourcePath
            entity.storageType = plugin.storageType || 'local'
            entity.metadata = JSON.stringify(plugin.metadata || {})
            return entity
        })

        if (pluginEntities.length > 0) {
            await appServer.AppDataSource.getRepository(ClaudeWSPlugin).save(pluginEntities)
        }
    } catch (error: any) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.syncPluginCache - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Clear plugin cache for a server
 */
const clearPluginCache = async (serverId: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        await appServer.AppDataSource.getRepository(ClaudeWSPlugin).delete({ serverId })
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: claudewsPluginService.clearPluginCache - ${getErrorMessage(error)}`
        )
    }
}

export default {
    listPlugins,
    getPlugin,
    discoverPlugins,
    uploadPlugin,
    confirmUpload,
    importPlugin,
    deletePlugin,
    listPluginFiles,
    getPluginFileContent,
    getPluginDependencies,
    installDependency,
    getFileContent,
    listFilesFromSource,
    getDependenciesFromSource,
    syncPluginCache,
    clearPluginCache
}
