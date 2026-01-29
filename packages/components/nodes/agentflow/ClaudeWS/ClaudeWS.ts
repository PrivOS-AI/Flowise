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
                const queryBuilder = appDataSource
                    .getRepository(databaseEntities['ClaudeWSServer'])
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
        },

        async listSkills(nodeData: INodeData, options: ICommonObject) {
            const returnData: { label: string; name: string; description: string }[] = []
            const serverId = nodeData.inputs?.claudewsServer

            if (!serverId) return returnData

            const appDataSource = options.appDataSource
            const databaseEntities = options.databaseEntities

            if (!appDataSource) return returnData

            try {
                // Get server info
                const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer']).findOneBy({ id: serverId })

                if (!server) return returnData

                // Decrypt API key
                const { decryptCredentialData } = await import('../../../src/utils')
                const decryptedData = await decryptCredentialData(server.apiKey)
                const apiKey = decryptedData.apiKey
                const baseUrl = server.endpointUrl.replace(/\/$/, '')

                // Fetch plugins from ClaudeWS server
                const response = await axios.get(`${baseUrl}/api/agent-factory/plugins`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    timeout: 10000
                })

                const plugins = response.data?.plugins || []

                // Get icon for plugin type
                const getTypeIcon = (type: string): string => {
                    const icons: Record<string, string> = {
                        skill: '🔧',
                        agent: '🤖',
                        command: '⚡',
                        'agent-set': '👥'
                    }
                    return icons[type] || '📦'
                }

                // Group by type and return as selectable options
                for (const plugin of plugins) {
                    const typeIcon = getTypeIcon(plugin.type)
                    returnData.push({
                        label: `${typeIcon} ${plugin.name}`,
                        name: plugin.id || plugin.name,
                        description: plugin.description || `${plugin.type} - ${plugin.name}`
                    })
                }

                console.log('[ClaudeWS Agentflow] Loaded skills:', returnData.length)
            } catch (error) {
                console.error('[ClaudeWS Agentflow] Error loading skills:', error)
            }

            return returnData
        },

        async syncSkillsToProject(nodeData: INodeData, options: ICommonObject, skillIds?: string[]) {
            if (!skillIds || skillIds.length === 0) {
                return { success: true, message: 'No skills to sync', synced: 0 }
            }

            const serverId = nodeData.inputs?.claudewsServer
            if (!serverId) {
                throw new Error('ClaudeWS Server is required to sync skills')
            }

            const appDataSource = options.appDataSource
            const databaseEntities = options.databaseEntities

            if (!appDataSource) {
                throw new Error('AppDataSource not available')
            }

            try {
                // Get server info
                const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer']).findOneBy({ id: serverId })

                if (!server) {
                    throw new Error('ClaudeWS Server not found')
                }

                // Decrypt API key
                const decryptedData = await decryptCredentialData(server.apiKey)
                const apiKey = decryptedData.apiKey
                const baseUrl = server.endpointUrl.replace(/\/$/, '')

                // Get project ID from node input (roomId serves as projectId in ClaudeWS)
                const projectId = nodeData.inputs?.claudewsRoomId as string | undefined

                if (!projectId) {
                    throw new Error('Room ID is required to sync skills to project')
                }

                console.log('[ClaudeWS Agentflow] Syncing skills to project:', {
                    projectId,
                    skillIds,
                    count: skillIds.length
                })

                // Batch sync all skills at once using /sync endpoint
                const response = await axios.post(
                    `${baseUrl}/api/agent-factory/projects/${projectId}/sync`,
                    {
                        componentIds: skillIds,
                        agentSetIds: []
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        },
                        timeout: 30000
                    }
                )

                console.log('[ClaudeWS Agentflow] Skills sync completed:', {
                    synced: skillIds.length,
                    total: skillIds.length,
                    response: response.data
                })

                return {
                    success: true,
                    synced: skillIds.length,
                    total: skillIds.length
                }
            } catch (error: any) {
                console.error('[ClaudeWS Agentflow] Error syncing skills:', error)
                return {
                    success: false,
                    error: error.response?.data?.error || error.message,
                    synced: 0
                }
            }
        },

        async getInstalledSkills(nodeData: INodeData, options: ICommonObject) {
            const returnData: { label: string; name: string; description: string }[] = []
            const serverId = nodeData.inputs?.claudewsServer
            const roomId = nodeData.inputs?.claudewsRoomId as string | undefined

            if (!serverId || !roomId) return returnData

            const appDataSource = options.appDataSource
            const databaseEntities = options.databaseEntities

            if (!appDataSource) return returnData

            try {
                // Get server info
                const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer']).findOneBy({ id: serverId })

                if (!server) return returnData

                // Decrypt API key
                const decryptedData = await decryptCredentialData(server.apiKey)
                const apiKey = decryptedData.apiKey
                const baseUrl = server.endpointUrl.replace(/\/$/, '')

                // Get installed plugins for the project
                const response = await axios.get(`${baseUrl}/api/agent-factory/projects/${roomId}/installed`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    timeout: 10000
                })

                const plugins = response.data?.plugins || []

                for (const plugin of plugins) {
                    const typeIcon = plugin.type === 'skill' ? '🔧' : '📦'
                    returnData.push({
                        label: `${typeIcon} ${plugin.name}`,
                        name: plugin.id || plugin.name,
                        description: `Installed: ${plugin.description || plugin.name}`
                    })
                }

                console.log('[ClaudeWS Agentflow] Loaded installed skills:', returnData.length)
            } catch (error) {
                console.error('[ClaudeWS Agentflow] Error loading installed skills:', error)
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
                description: 'Name of the room on PrivOS Chat server',
                placeholder: 'my-room',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Room ID',
                name: 'claudewsRoomId',
                type: 'string',
                description: 'ID of the room on PrivOS Chat server',
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
                label: 'PrivOS Endpoint URL',
                name: 'privosEndpointUrl',
                type: 'string',
                description: 'PrivOS Endpoint URL so that ClaudeWS can use skills to interact with PrivOS',
                placeholder: 'https://privos.example.com',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Ai Chat Session Name',
                name: 'claudewsTaskName',
                type: 'string',
                description: 'Name of a PrivOS Ai chat session to continue',
                placeholder: 'task-name',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Ai Chat Session ID',
                name: 'claudewsTaskId',
                type: 'string',
                description: 'ID of a PrivOS Ai chat session to continue',
                placeholder: 'task-uuid',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Force to Create Session/Room if not exist',
                name: 'claudewsForceCreate',
                type: 'boolean',
                description: 'Force create room or task if they do not exist',
                optional: true,
                default: true
            },
            {
                label: 'Import Skills to Project',
                name: 'claudewsImportSkills',
                type: 'boolean',
                description:
                    'Import selected skills to the ClaudeWS project (required for skills to work). If false, skills must already be imported.',
                optional: true,
                default: true
            },
            {
                label: 'Enabled Skills',
                name: 'claudewsEnabledSkills',
                type: 'asyncMultiOptions',
                loadMethod: 'listSkills',
                description: 'Select skills to enable for this execution (auto-fetched from ClaudeWS server)',
                optional: true,
                default: []
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
                            { label: 'User', name: 'user' },
                            { label: 'Assistant', name: 'assistant' }
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
        const privosEndpointUrl = nodeData.inputs?.privosEndpointUrl as string | undefined
        const taskName = nodeData.inputs?.claudewsTaskName as string | undefined
        let taskId = nodeData.inputs?.claudewsTaskId as string | undefined
        const forceCreate = nodeData.inputs?.claudewsForceCreate as boolean | undefined
        const importSkills = nodeData.inputs?.claudewsImportSkills as boolean | undefined
        const enabledSkills = nodeData.inputs?.claudewsEnabledSkills as string[] | undefined
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
        const server = await appDataSource.getRepository(databaseEntities['ClaudeWSServer']).findOneBy({ id: serverId })

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
        console.log('[ClaudeWS Agentflow] Initial room values:', {
            roomIdInput: roomId,
            roomNameInput: roomName,
            roomSessionKeyInput: roomSessionKey,
            privosEndpointUrlInput: privosEndpointUrl,
            taskNameInput: taskName
        })

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
            console.log('[ClaudeWS Agentflow] Resolved room ID from name:', {
                roomName,
                resolvedRoomId
            })
        }

        console.log('[ClaudeWS Agentflow] Final room values before execution:', {
            resolvedRoomId,
            roomName,
            roomSessionKey,
            privosEndpointUrl,
            taskName,
            taskId
        })

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

        // Sync skills to project if import is enabled and skills are selected
        if (importSkills !== false && enabledSkills && Array.isArray(enabledSkills) && enabledSkills.length > 0) {
            console.log('[ClaudeWS Agentflow] Syncing skills to project...', {
                projectId: resolvedRoomId,
                skillCount: enabledSkills.length,
                skills: enabledSkills
            })

            try {
                // Batch sync all skills at once using Agent Factory /sync endpoint
                await axios.post(
                    `${baseUrl}/api/agent-factory/projects/${resolvedRoomId}/sync`,
                    {
                        componentIds: enabledSkills,
                        agentSetIds: []
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        },
                        timeout: 30000
                    }
                )

                console.log('[ClaudeWS Agentflow] Skills sync completed:', {
                    total: enabledSkills.length,
                    projectId: resolvedRoomId
                })
            } catch (syncError: any) {
                console.error('[ClaudeWS Agentflow] Error during skill sync:', syncError.response?.data || syncError.message)
                // Continue anyway - skills might already be installed
            }
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
                streamer,
                forceCreate,
                resolvedRoomId,
                roomName,
                roomSessionKey,
                privosEndpointUrl,
                taskName,
                enabledSkills
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
        streamer: any,
        forceCreate?: boolean,
        roomId?: string,
        roomNameParam?: string,
        roomSessionKeyParam?: string,
        privosEndpointUrlParam?: string,
        taskNameParam?: string,
        enabledSkills?: string[]
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
                const attemptPayload: ICommonObject = {
                    taskId,
                    prompt,
                    displayPrompt: prompt,
                    fileIds: []
                }

                // Add force_create and related fields if enabled
                if (forceCreate) {
                    attemptPayload.force_create = true
                    // Include room/project information for auto-creation
                    // Use the values provided, or use empty string to trigger creation
                    attemptPayload.projectId = roomId || ''
                    attemptPayload.projectName = roomNameParam || ''
                    attemptPayload.taskTitle = taskNameParam || prompt.substring(0, 50)
                }

                // Add additional fields if they have values
                if (roomSessionKeyParam) {
                    attemptPayload.roomSessionKey = roomSessionKeyParam
                }
                if (privosEndpointUrlParam) {
                    attemptPayload.privosEndpointUrl = privosEndpointUrlParam
                }

                // Add enabled skills if provided
                if (enabledSkills && Array.isArray(enabledSkills) && enabledSkills.length > 0) {
                    attemptPayload.enabledSkills = enabledSkills
                }

                console.log('[ClaudeWS Agentflow] Sending attempt:start to ClaudeWS server:', {
                    baseUrl,
                    roomId,
                    roomName: roomNameParam,
                    roomSessionKey: roomSessionKeyParam,
                    privosEndpointUrl: privosEndpointUrlParam,
                    taskName: taskNameParam,
                    taskId,
                    enabledSkills: enabledSkills || [],
                    prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
                    displayPrompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
                    force_create: attemptPayload.force_create,
                    projectId: attemptPayload.projectId,
                    projectName: attemptPayload.projectName,
                    taskTitle: attemptPayload.taskTitle,
                    payloadRoomSessionKey: attemptPayload.roomSessionKey,
                    payloadPrivosEndpointUrl: attemptPayload.privosEndpointUrl,
                    payloadEnabledSkills: attemptPayload.enabledSkills,
                    fileIds: attemptPayload.fileIds
                })
                console.log('[ClaudeWS Agentflow] Exact payload being sent:', JSON.stringify(attemptPayload, null, 2))
                socket.emit('attempt:start', attemptPayload)
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
                                        const tool = usedTools.find((t) => t.toolInput?.toolUseId === block.tool_use_id)
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
