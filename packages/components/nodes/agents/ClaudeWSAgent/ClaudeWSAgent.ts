/**
 * ClaudeWS Agent Node
 * Execute AI tasks on ClaudeWS servers with streaming responses
 */

import axios from 'axios'
import { io } from 'socket.io-client'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'

interface ClaudeWSOutput {
    type: string
    delta?: {
        type: string
        text?: string
        thinking?: string
    }
    tool_name?: string
    input?: unknown
}

interface ClaudeWSAgentFields {
    sessionId?: string
}

class ClaudeWSAgent_Agents implements INode {
    label: string
    name: string
    version: number
    type: string
    category: string
    icon: string
    description: string
    baseClasses: string[]
    inputs: INodeParams[]
    sessionId?: string

    /**
     * Load methods for async options dropdowns
     */
    //@ts-ignore
    loadMethods = {
        /**
         * List available ClaudeWS servers
         */
        async listServers(_: INodeData, options: ICommonObject) {
            const returnData: { label: string; name: string; description: string }[] = []
            const appDataSource = options.appDataSource
            const databaseEntities = options.databaseEntities
            const user = options.user

            if (!appDataSource) return returnData

            try {
                const queryBuilder = appDataSource.getRepository(databaseEntities['ClaudeWSServer'])
                    .createQueryBuilder('server')
                    .where('server.isActive = :isActive', { isActive: true })

                // Room isolation
                if (!user?.isRootAdmin && user?.activeRoomId) {
                    queryBuilder.andWhere('(server.roomId = :roomId OR server.roomId IS NULL)', {
                        roomId: user.activeRoomId
                    })
                }

                const servers = await queryBuilder.getMany()
                for (const server of servers) {
                    returnData.push({
                        label: server.name,
                        name: server.id,
                        description: server.endpointUrl
                    })
                }
            } catch (error) {
                console.error('[ClaudeWSAgent] Error loading servers:', error)
            }

            return returnData
        },

        /**
         * List projects from selected server
         */
        async listProjects(nodeData: INodeData, options: ICommonObject) {
            const returnData: { label: string; name: string; description: string }[] = []
            const serverId = nodeData.inputs?.claudewsServer

            if (!serverId) return returnData

            const appDataSource = options.appDataSource
            const databaseEntities = options.databaseEntities

            if (!appDataSource) return returnData

            try {
                // Get server
                const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer'])
                    .findOneBy({ id: serverId })

                if (!server) return returnData

                // Decrypt API key and fetch projects
                const { decryptCredentialData } = await import('../../../src/utils')
                const decryptedData = await decryptCredentialData(server.apiKey)
                const apiKey = decryptedData.apiKey

                const response = await axios.get(`${server.endpointUrl.replace(/\/$/, '')}/api/projects`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    timeout: 10000
                })

                for (const project of response.data || []) {
                    returnData.push({
                        label: project.name,
                        name: project.id,
                        description: project.path
                    })
                }
            } catch (error) {
                console.error('[ClaudeWSAgent] Error loading projects:', error)
            }

            return returnData
        }
    }

    constructor(fields?: ClaudeWSAgentFields) {
        this.label = 'ClaudeWS Agent'
        this.name = 'claudeWSAgent'
        this.version = 1.0
        this.type = 'ClaudeWSAgent'
        this.category = 'Agents'
        this.icon = 'claudews-agent.svg'
        this.description = 'Execute AI tasks on a ClaudeWS server with streaming responses'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'ClaudeWS Server',
                name: 'claudewsServer',
                type: 'asyncOptions',
                loadMethod: 'listServers',
                description: 'Select a ClaudeWS server to connect to'
            },
            {
                label: 'Project',
                name: 'project',
                type: 'asyncOptions',
                loadMethod: 'listProjects',
                description: 'Select a project on the server'
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseChatMemory',
                description: 'Memory for conversation history and session tracking'
            },
            {
                label: 'System Message',
                name: 'systemMessage',
                type: 'string',
                rows: 4,
                default: '',
                optional: true,
                additionalParams: true,
                description: 'Prepended to the first message as context'
            }
        ]
        this.sessionId = fields?.sessionId
    }

    /**
     * Initialize node configuration
     */
    async init(nodeData: INodeData, _input: string, _options: ICommonObject): Promise<ICommonObject> {
        return {
            serverId: nodeData.inputs?.claudewsServer,
            projectId: nodeData.inputs?.project,
            systemMessage: nodeData.inputs?.systemMessage
        }
    }

    /**
     * Execute the agent - create task and run attempt
     */
    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string> {
        const config = await this.init(nodeData, input, options)
        const memory = nodeData.inputs?.memory

        const { user, chatId, shouldStreamResponse, sseStreamer } = options

        const appDataSource = options.appDataSource
        const databaseEntities = options.databaseEntities

        // Validate required inputs
        if (!config.serverId) throw new Error('ClaudeWS Server is required')
        if (!config.projectId) throw new Error('Project is required')
        if (!memory) throw new Error('Memory is required for ClaudeWS Agent')
        if (!appDataSource) throw new Error('Database connection not available')

        // Get server from database
        const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer'])
            .findOneBy({ id: config.serverId })

        if (!server) throw new Error('ClaudeWS Server not found')

        // Room isolation check
        if (!user?.isRootAdmin && server.roomId !== null && server.roomId !== user?.activeRoomId) {
            throw new Error('Cannot access server from another room')
        }

        // Decrypt API key
        const { decryptCredentialData } = await import('../../../src/utils')
        const decryptedData = await decryptCredentialData(server.apiKey)
        const apiKey = decryptedData.apiKey
        const baseUrl = server.endpointUrl.replace(/\/$/, '')

        // Get or create task ID from memory
        let taskId = await this.getTaskIdFromMemory(memory, this.sessionId)

        // Build prompt with system message for first turn
        let prompt = input
        const hasHistory = await this.hasConversationHistory(memory, this.sessionId)

        if (config.systemMessage && !hasHistory) {
            prompt = `${config.systemMessage}\n\n${input}`
        }

        // First message: Create task with first message as title
        if (!taskId) {
            const taskPayload: ICommonObject = {
                projectId: config.projectId,
                title: prompt,
                description: config.systemMessage || null,
                status: 'todo'
            }

            const taskResponse = await axios.post(`${baseUrl}/api/tasks`, taskPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                timeout: 30000
            })

            taskId = taskResponse.data.id
        }

        // Validate taskId before proceeding
        if (!taskId) {
            throw new Error('Failed to create or retrieve task ID')
        }

        // Execute attempt with streaming
        const streamer = sseStreamer
        let fullResponse = ''

        try {
            fullResponse = await this.executeStreamingAttempt(
                baseUrl,
                apiKey,
                taskId,
                prompt,
                chatId,
                shouldStreamResponse,
                streamer
            )
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred'
            if (shouldStreamResponse && streamer && chatId) {
                streamer.streamCustomEvent(chatId, 'error', { message: errorMessage })
            }
            throw error
        }

        // Save to memory
        await memory.addChatMessages([
            { text: input, type: 'userMessage' },
            { text: fullResponse, type: 'apiMessage' }
        ], this.sessionId)

        return fullResponse
    }

    /**
     * Execute streaming attempt via Socket.io
     */
    private async executeStreamingAttempt(
        baseUrl: string,
        apiKey: string,
        taskId: string,
        prompt: string,
        chatId: string,
        shouldStreamResponse: boolean,
        streamer: any
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let fullResponse = ''
            let resolved = false

            const socket = io(baseUrl, {
                reconnection: false,
                timeout: 10000,
                auth: { 'x-api-key': apiKey },
                extraHeaders: { 'x-api-key': apiKey }
            })

            const cleanup = () => {
                socket.removeAllListeners()
                socket.disconnect()
            }

            socket.on('connect', () => {
                // Start the attempt
                socket.emit('attempt:start', {
                    taskId,
                    prompt,
                    displayPrompt: prompt,
                    fileIds: []
                })
            })

            socket.on('connect_error', (err: Error) => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error(`Connection failed: ${err.message}`))
            })

            socket.on('output:json', (data: { data: ClaudeWSOutput }) => {
                const output = data.data

                switch (output.type) {
                    case 'content_block_delta':
                        if (output.delta?.type === 'text_delta' && output.delta.text) {
                            fullResponse += output.delta.text
                            if (shouldStreamResponse && streamer && chatId) {
                                streamer.streamTokenEvent(chatId, output.delta.text)
                            }
                        } else if (output.delta?.type === 'thinking_delta' && output.delta.thinking) {
                            if (shouldStreamResponse && streamer && chatId) {
                                streamer.streamThinkingEvent(chatId, output.delta.thinking)
                            }
                        }
                        break

                    case 'tool_use':
                        if (shouldStreamResponse && streamer && chatId) {
                            streamer.streamToolEvent(chatId, {
                                name: output.tool_name || '',
                                input: output.input
                            })
                        }
                        break
                }
            })

            socket.on('attempt:finished', () => {
                if (resolved) return
                resolved = true
                cleanup()
                resolve(fullResponse)
            })

            socket.on('error', (data: { message: string }) => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error(data.message))
            })

            // Timeout after 5 minutes
            setTimeout(() => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error('Attempt timeout'))
            }, 5 * 60 * 1000)
        })
    }

    /**
     * Get task ID from memory
     */
    private async getTaskIdFromMemory(memory: any, sessionId?: string): Promise<string | null> {
        if (!sessionId) return null

        try {
            const context = await memory.getChatMessages(sessionId, false)

            // If we have history, there must be a task
            // Task ID is not stored separately - we rely on ClaudeWS session continuity
            if (context && Array.isArray(context) && context.length > 0) {
                // Look for task ID in metadata if available
                for (const msg of context) {
                    const msgAny = msg as any
                    if (msgAny?.additional_kwargs?.claudewsTaskId) {
                        return msgAny.additional_kwargs.claudewsTaskId
                    }
                }
            }
        } catch (e) {
            // Ignore errors
        }

        return null
    }

    /**
     * Check if conversation has history
     */
    private async hasConversationHistory(memory: any, sessionId?: string): Promise<boolean> {
        if (!sessionId) return false

        try {
            const context = await memory.getChatMessages(sessionId, false)
            return Array.isArray(context) && context.length > 0
        } catch (e) {
            return false
        }
    }
}

module.exports = { nodeClass: ClaudeWSAgent_Agents }
