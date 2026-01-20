/**
 * ClaudeWS Agentflow Node
 * Execute AI tasks on ClaudeWS servers with streaming responses in Agentflows
 */

import axios from 'axios'
import { io } from 'socket.io-client'
import { decryptCredentialData } from '../../../src/utils'
import { updateFlowState } from '../utils'
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

class ClaudeWS_Agentflow implements INode {
    label: string
    name: string
    version: number
    type: string
    category: string
    description: string
    color: string
    icon: string
    baseClasses: string[]
    inputs: INodeParams[]

    /**
     * Load methods for async options
     */
    //@ts-ignore
    loadMethods = {
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
                console.error('[ClaudeWS Agentflow] Error loading servers:', error)
            }

            return returnData
        }
    }

    constructor() {
        this.label = 'ClaudeWS'
        this.name = 'claudeWSAgentflow'
        this.version = 1.0
        this.type = 'ClaudeWS'
        this.category = 'Agent Flows'
        this.description = 'Execute AI tasks on a ClaudeWS server with streaming responses'
        this.color = '#6366f1'
        this.icon = 'claudews.svg'
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
                label: 'Room Name',
                name: 'claudewsRoomName',
                type: 'string',
                description: 'Name of the room on ClaudeWS server',
                placeholder: 'my-room',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Room ID',
                name: 'claudewsRoomId',
                type: 'string',
                description: 'ID of the room on ClaudeWS server',
                placeholder: 'room-uuid',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Room Session Key',
                name: 'claudewsRoomSessionKey',
                type: 'string',
                description: 'Session key for the room',
                placeholder: 'session-key',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Task Name',
                name: 'claudewsTaskName',
                type: 'string',
                description: 'Name of an existing task to continue',
                placeholder: 'task-name',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Task ID',
                name: 'claudewsTaskId',
                type: 'string',
                description: 'ID of an existing task to continue',
                placeholder: 'task-uuid',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Messages',
                name: 'claudewsMessages',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Role',
                        name: 'role',
                        type: 'options',
                        options: [
                            { label: 'System', name: 'system' },
                            { label: 'User', name: 'user' }
                        ]
                    },
                    {
                        label: 'Content',
                        name: 'content',
                        type: 'string',
                        acceptVariable: true,
                        generateInstruction: true,
                        rows: 4
                    }
                ]
            },
            {
                label: 'Update Flow State',
                name: 'claudewsUpdateFlowState',
                description: 'Update runtime state during execution',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'string',
                        placeholder: 'myKey'
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true
                    }
                ]
            }
        ]
    }

    /**
     * Run the ClaudeWS node
     */
    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<ICommonObject> {
        const serverId = nodeData.inputs?.claudewsServer
        const roomName = nodeData.inputs?.claudewsRoomName as string | undefined
        const roomId = nodeData.inputs?.claudewsRoomId as string | undefined
        const roomSessionKey = nodeData.inputs?.claudewsRoomSessionKey as string | undefined
        const taskName = nodeData.inputs?.claudewsTaskName as string | undefined
        let taskId = nodeData.inputs?.claudewsTaskId as string | undefined
        const messages = nodeData.inputs?.claudewsMessages as Array<{ role: string; content: string }> | undefined
        const updateStateConfig = nodeData.inputs?.claudewsUpdateFlowState as Array<{ key: string; value: string }> | undefined

        const { user, chatId, sseStreamer } = options
        const isLastNode = options.isLastNode as boolean
        const shouldStream = isLastNode && sseStreamer !== undefined

        const appDataSource = options.appDataSource
        const databaseEntities = options.databaseEntities

        // Validate required inputs
        if (!serverId) throw new Error('ClaudeWS Server is required')
        if (!roomId && !roomName) throw new Error('Room ID or Room Name is required')

        // Get server from database
        const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer'])
            .findOneBy({ id: serverId })

        if (!server) throw new Error('ClaudeWS Server not found')

        // Room isolation check
        if (!user?.isRootAdmin && server.roomId !== null && server.roomId !== user?.activeRoomId) {
            throw new Error('Cannot access server from another room')
        }

        // Decrypt API key
        const decryptedData = await decryptCredentialData(server.apiKey)
        const apiKey = decryptedData.apiKey
        const baseUrl = server.endpointUrl.replace(/\/$/, '')

        // Build prompt from messages
        let prompt = ''
        if (messages && messages.length > 0) {
            for (const msg of messages) {
                if (msg.role === 'system') {
                    prompt += `${msg.content}\n\n`
                }
            }
        }

        // Add user message from input
        if (input) {
            prompt += input
        }

        if (!prompt.trim()) {
            throw new Error('No message content provided')
        }

        // Resolve room ID if only room name is provided
        let resolvedRoomId = roomId
        if (!resolvedRoomId && roomName) {
            // Fetch rooms and find by name
            const roomsResponse = await axios.get(`${baseUrl}/api/rooms`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                timeout: 10000
            })
            const room = roomsResponse.data?.find((r: any) => r.name === roomName)
            if (!room) {
                throw new Error(`Room with name "${roomName}" not found`)
            }
            resolvedRoomId = room.id
        }

        // If no task ID provided, create a new task or find by name
        if (!taskId) {
            if (taskName) {
                // Try to find existing task by name in the room
                const tasksResponse = await axios.get(`${baseUrl}/api/tasks?roomId=${resolvedRoomId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    timeout: 10000
                })
                const existingTask = tasksResponse.data?.find((t: any) => t.title === taskName)
                if (existingTask) {
                    taskId = existingTask.id
                }
            }

            // If still no task ID, create a new task
            if (!taskId) {
                const taskPayload: ICommonObject = {
                    roomId: resolvedRoomId,
                    title: taskName || prompt,
                    description: null,
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
        }

        // Ensure we have a task ID at this point
        if (!taskId) {
            throw new Error('Failed to create or find task')
        }

        // Execute streaming attempt via Socket.io
        // The attempt will be created automatically when we emit attempt:start
        const streamer = sseStreamer
        let fullResponse = ''

        try {
            const result = await this.executeStreamingAttempt(
                baseUrl,
                apiKey,
                taskId,
                prompt,
                chatId,
                shouldStream,
                streamer
            )
            fullResponse = result.text
            const usedTools = result.usedTools || []

            // Stream used tools if this is the last node
            if (shouldStream && streamer && chatId && usedTools.length > 0) {
                streamer.streamUsedToolsEvent(chatId, usedTools)
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred'
            if (shouldStream && streamer && chatId) {
                streamer.streamCustomEvent(chatId, 'error', { message: errorMessage })
            }
            throw error
        }

        // Get current state from runtime
        const state = options.agentflowRuntime?.state || {}

        // Update flow state if configured
        let newState = { ...state }
        if (updateStateConfig && Array.isArray(updateStateConfig) && updateStateConfig.length > 0) {
            newState = updateFlowState(state, updateStateConfig)
        }

        // Build user input message for chat history
        const inputMessages: Array<{ role: string; content: string }> = []
        if (input) {
            inputMessages.push({ role: 'user', content: input })
        }

        // Return proper agentflow response format
        return {
            id: nodeData.id,
            name: this.name,
            input: {
                ...nodeData.inputs
            },
            output: {
                content: fullResponse,
                taskId
            },
            state: newState,
            chatHistory: [
                ...inputMessages,
                {
                    role: 'assistant',
                    content: fullResponse,
                    name: nodeData?.label ? nodeData?.label.toLowerCase().replace(/\s/g, '_').trim() : nodeData?.id
                }
            ]
        }
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
        shouldStream: boolean,
        streamer: any
    ): Promise<{ text: string; usedTools: any[] }> {
        return new Promise((resolve, reject) => {
            let fullResponse = ''
            let resolved = false
            let attemptId: string | null = null
            const usedTools: any[] = []

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
                // Start the attempt - the server will create it and emit attempt:started
                socket.emit('attempt:start', {
                    taskId,
                    prompt,
                    displayPrompt: prompt,
                    fileIds: []
                })
            })

            socket.on('attempt:started', (data: { attemptId: string }) => {
                attemptId = data.attemptId
                // Server already joined us to the room automatically
                // No need to manually subscribe
            })

            socket.on('connect_error', (err: Error) => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error(`Connection failed: ${err.message}`))
            })

            socket.on('output:json', (data: { attemptId: string; data: ClaudeWSOutput }) => {
                // Only process messages for this attempt
                if (!attemptId || data.attemptId !== attemptId) {
                    return
                }

                const output = data.data

                switch (output.type) {
                    case 'content_block_delta':
                        if (output.delta?.type === 'text_delta' && output.delta.text) {
                            fullResponse += output.delta.text
                            if (shouldStream && streamer && chatId) {
                                streamer.streamTokenEvent(chatId, output.delta.text)
                            }
                        } else if (output.delta?.type === 'thinking_delta' && output.delta.thinking) {
                            if (shouldStream && streamer && chatId) {
                                streamer.streamThinkingEvent(chatId, output.delta.thinking)
                            }
                        }
                        break

                    case 'assistant':
                        // Complete assistant message - extract text from it
                        if ((output as any).message && (output as any).message.content) {
                            const content = (output as any).message.content
                            if (Array.isArray(content)) {
                                // Extract text and tool_use from content blocks
                                for (const block of content) {
                                    if (block.type === 'text' && block.text) {
                                        // Append to fullResponse (deltas are incremental)
                                        fullResponse += block.text
                                        if (shouldStream && streamer && chatId) {
                                            streamer.streamTokenEvent(chatId, block.text)
                                        }
                                    } else if (block.type === 'tool_use') {
                                        // Collect tool_use from assistant messages
                                        const filePath = block.input?.file_path || ''
                                        const toolLabel = filePath ? `${block.name} → ${filePath}` : block.name
                                        usedTools.push({
                                            tool: toolLabel,
                                            toolInput: {
                                                ...block.input,
                                                toolUseId: block.id // Store tool_use_id to match with results
                                            },
                                            toolOutput: '' // Will be filled when tool_result is received
                                        })
                                    }
                                }
                            } else if (typeof content === 'string' && content) {
                                fullResponse += content
                                if (shouldStream && streamer && chatId) {
                                    streamer.streamTokenEvent(chatId, content)
                                }
                            }
                        }
                        break

                    case 'tool_use':
                        // Collect standalone tool_use events
                        usedTools.push({
                            tool: output.tool_name || '',
                            toolInput: output.input || {},
                            toolOutput: ''
                        })
                        break

                    case 'user':
                        // Check if this is a tool_result message
                        if ((output as any).message && (output as any).message.content) {
                            const content = (output as any).message.content
                            if (Array.isArray(content)) {
                                for (const block of content) {
                                    if (block.type === 'tool_result') {
                                        // Find the corresponding tool and update its output
                                        const tool = usedTools.find(t => t.toolInput?.toolUseId === block.tool_use_id)
                                        if (tool) {
                                            tool.toolOutput = block.content || 'Tool executed successfully'
                                        }
                                    }
                                }
                            }
                        }
                        break
                }
            })

            socket.on('attempt:finished', (data: { attemptId: string }) => {
                if (!attemptId || data.attemptId !== attemptId) return
                if (resolved) return
                resolved = true
                cleanup()
                resolve({ text: fullResponse, usedTools })
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
}

module.exports = { nodeClass: ClaudeWS_Agentflow }
