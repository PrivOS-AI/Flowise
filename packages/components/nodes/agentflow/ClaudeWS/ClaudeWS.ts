import axios from 'axios'
import { io } from 'socket.io-client'
import { decryptCredentialData } from '../../../src/utils'
import { updateFlowState } from '../utils'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { claudewsQuestionStorage, Question } from './question-storage'
import { DEFAULT_TIMEOUT_MS, ClaudeWSOutputEventTypes, ClaudeWSDeltaTypes, ClaudeWSContentBlockTypes, SocketEventNames } from './constants'
import { StatusCodes } from 'http-status-codes'

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

interface QuestionAskData {
    attemptId: string
    toolUseId: string
    questions: Question[]
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
                    }
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

                    // Use plugin.id as the value (will be used in selectedComponents array)
                    // DO NOT fallback to plugin.name - ID must be the actual database ID
                    if (!plugin.id) {
                        console.warn('[ClaudeWS Agentflow] Plugin missing ID, skipping:', plugin.name)
                        continue
                    }

                    returnData.push({
                        label: `${typeIcon} ${plugin.name}`,
                        name: plugin.id, // Always use the ID, not the name
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
                        }
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
                    }
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

        // Ensure server is configured
        if (!serverId) {
            return {
                output: { content: '' },
                state: {},
                chatHistory: [],
                input: nodeData.inputs || {},
                id: nodeData.id,
                name: this.name
            }
        }
        const roomName = nodeData.inputs?.claudewsRoomName as string | undefined
        const roomId = nodeData.inputs?.claudewsRoomId as string | undefined
        const roomSessionKey = nodeData.inputs?.claudewsRoomSessionKey as string | undefined
        const privosEndpointUrl = nodeData.inputs?.privosEndpointUrl as string | undefined
        const taskName = nodeData.inputs?.claudewsTaskName as string | undefined
        let taskId = nodeData.inputs?.claudewsTaskId as string | undefined
        const forceCreate = nodeData.inputs?.claudewsForceCreate as boolean | undefined
        const importSkills = nodeData.inputs?.claudewsImportSkills as boolean | undefined

        // Handle enabledSkills - can be string (single selection) or array (multi-selection)
        let enabledSkills: string[] | undefined
        const rawEnabledSkills = nodeData.inputs?.claudewsEnabledSkills

        console.log('[ClaudeWS Agentflow] Raw enabledSkills input:', {
            rawValue: rawEnabledSkills,
            jsonRaw: JSON.stringify(rawEnabledSkills, null, 2),
            type: typeof rawEnabledSkills,
            isArray: Array.isArray(rawEnabledSkills),
            length: Array.isArray(rawEnabledSkills) ? rawEnabledSkills.length : 'N/A',
            firstItemType: Array.isArray(rawEnabledSkills) && rawEnabledSkills.length > 0 ? typeof rawEnabledSkills[0] : 'N/A',
            firstItemSample: Array.isArray(rawEnabledSkills) && rawEnabledSkills.length > 0 ? rawEnabledSkills[0] : 'N/A'
        })

        if (rawEnabledSkills) {
            if (typeof rawEnabledSkills === 'string') {
                // Try to parse as JSON array first (format: ["id1","id2"])
                try {
                    enabledSkills = JSON.parse(rawEnabledSkills)
                    if (Array.isArray(enabledSkills)) {
                        console.log('[ClaudeWS Agentflow] Parsed as JSON array:', enabledSkills)
                    } else {
                        // If parsed but not array, treat as single skill
                        enabledSkills = [rawEnabledSkills]
                        console.log('[ClaudeWS Agentflow] Parsed as single skill string:', enabledSkills)
                    }
                } catch (parseError) {
                    // Not valid JSON, try comma-separated format
                    enabledSkills = rawEnabledSkills
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    console.log('[ClaudeWS Agentflow] Parsed as comma-separated string:', enabledSkills)
                }
            } else if (Array.isArray(rawEnabledSkills)) {
                // Handle different array formats from asyncMultiOptions
                console.log('[ClaudeWS Agentflow] Processing array items...')
                enabledSkills = rawEnabledSkills
                    .map((item: any, index: number) => {
                        console.log(`[ClaudeWS Agentflow]   Item ${index}:`, {
                            value: item,
                            type: typeof item,
                            keys: typeof item === 'object' && item !== null ? Object.keys(item) : 'N/A'
                        })

                        // If item is string, use it directly
                        if (typeof item === 'string') {
                            console.log(`[ClaudeWS Agentflow]   → Using string value: ${item}`)
                            return item
                        }
                        // If item is object with 'name' property (from asyncMultiOptions)
                        if (item && typeof item === 'object' && item.name && typeof item.name === 'string') {
                            console.log(`[ClaudeWS Agentflow]   → Using item.name: ${item.name}`)
                            return item.name
                        }
                        // If item is object with 'value' property
                        if (item && typeof item === 'object' && item.value && typeof item.value === 'string') {
                            console.log(`[ClaudeWS Agentflow]   → Using item.value: ${item.value}`)
                            return item.value
                        }
                        // Skip invalid items
                        console.log(`[ClaudeWS Agentflow]   → Could not extract value, returning null`)
                        return null
                    })
                    .filter((skill): skill is string => skill !== null && skill.length > 0)

                console.log('[ClaudeWS Agentflow] Final parsed array:', enabledSkills)
            } else if (typeof rawEnabledSkills === 'object') {
                // Might be an object with value property (some UI components)
                console.log('[ClaudeWS Agentflow] Processing as plain object...')
                enabledSkills = Object.values(rawEnabledSkills).filter((v): v is string => typeof v === 'string' && v.length > 0)
                console.log('[ClaudeWS Agentflow] Parsed from object values:', enabledSkills)
            }

            console.log('[ClaudeWS Agentflow] Final enabledSkills:', {
                count: enabledSkills?.length || 0,
                skills: enabledSkills
            })
        } else {
            console.log('[ClaudeWS Agentflow] No enabledSkills provided')
        }

        const messages = nodeData.inputs?.claudewsMessages as Array<{ role: string; content: string }> | undefined
        const updateStateConfig = nodeData.inputs?.claudewsUpdateFlowState as Array<{ key: string; value: string }> | undefined

        const { user, chatId, sseStreamer } = options
        const isLastNode = options.isLastNode as boolean
        const shouldStream = isLastNode && sseStreamer !== undefined

        const appDataSource = options.appDataSource
        const databaseEntities = options.databaseEntities

        // Validate required inputs (serverId already checked at the beginning)
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
        // NOTE: In ClaudeWS, "room" = "project"
        console.log('[ClaudeWS Agentflow] Initial project/room values:', {
            roomIdInput: roomId,
            roomNameInput: roomName,
            roomSessionKeyInput: roomSessionKey,
            privosEndpointUrlInput: privosEndpointUrl,
            taskNameInput: taskName
        })

        let resolvedRoomId = roomId

        if (resolvedRoomId) {
            // User provided a roomId, verify it exists
            console.log('[ClaudeWS Agentflow] Verifying project exists:', resolvedRoomId)

            try {
                // Try to fetch the specific project
                await axios.get(`${baseUrl}/api/projects/${resolvedRoomId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    }
                })
                console.log('[ClaudeWS Agentflow] Project verified:', resolvedRoomId)
            } catch (verifyError: any) {
                if (verifyError.response?.status === StatusCodes.NOT_FOUND) {
                    console.log('[ClaudeWS Agentflow] Project not found in database, creating...')

                    if (!forceCreate) {
                        throw new Error(`Project "${resolvedRoomId}" not found. Enable "Force Create" to create it automatically.`)
                    }

                    // Create project with the provided ID as name
                    const projectPayload = {
                        name: roomName || resolvedRoomId,
                        path: resolvedRoomId
                    }

                    const projectResponse = await axios.post(`${baseUrl}/api/projects`, projectPayload, {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        }
                    })

                    resolvedRoomId = projectResponse.data.id
                    console.log('[ClaudeWS Agentflow] Project created successfully:', {
                        id: resolvedRoomId,
                        name: projectResponse.data.name,
                        path: projectResponse.data.path
                    })
                } else {
                    throw new Error(`Failed to verify project: ${verifyError.message}`)
                }
            }
        } else if (!resolvedRoomId && roomName) {
            console.log('[ClaudeWS Agentflow] Fetching projects to check if exists:', roomName)

            const projectsResponse = await axios.get(`${baseUrl}/api/projects`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                }
            })

            const project = projectsResponse.data?.find((p: any) => p.name === roomName)
            if (!project) {
                throw new Error(`Project with name "${roomName}" not found. Please create it first in ClaudeWS Agentflow.`)
            }

            resolvedRoomId = project.id
            console.log('[ClaudeWS Agentflow] ✅ Found existing project:', {
                name: roomName,
                id: resolvedRoomId,
                path: project.path
            })
        }

        console.log('[ClaudeWS Agentflow] Final project/room values:', {
            resolvedRoomId,
            roomName,
            roomSessionKey,
            privosEndpointUrl,
            taskName
        })

        // Step 2: Resolve or Create Task
        // If no task ID provided, create a new task or find by name
        if (!taskId) {
            if (taskName) {
                // Try to find existing task by name in the project
                const tasksResponse = await axios.get(`${baseUrl}/api/tasks?projectId=${resolvedRoomId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    }
                })
                const existingTask = tasksResponse.data?.find((t: any) => t.title === taskName)
                if (existingTask) {
                    taskId = existingTask.id
                    console.log('[ClaudeWS Agentflow] Found existing task:', taskId)
                }
            }

            // If still no task ID, create a new task
            if (!taskId) {
                console.log('[ClaudeWS Agentflow] Creating new task...')
                const taskPayload: ICommonObject = {
                    projectId: resolvedRoomId, // Use projectId instead of roomId
                    title: taskName || prompt.substring(0, 100),
                    description: prompt.substring(0, 500),
                    status: 'todo'
                }

                const taskResponse = await axios.post(`${baseUrl}/api/tasks`, taskPayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    }
                })

                taskId = taskResponse.data.id
                console.log('[ClaudeWS Agentflow] Task created:', taskId)
            }
        }

        if (!taskId) {
            throw new Error('Failed to create or find task')
        }

        console.log('[ClaudeWS Agentflow] Step 3: Creating/updating project settings...')

        // Prepare skills - use enabledSkills if provided, otherwise empty array
        // Define at higher scope so it's accessible in all steps
        const skillsToSync = importSkills !== false && enabledSkills && Array.isArray(enabledSkills) ? enabledSkills : []

        console.log('[ClaudeWS Agentflow] Skills to sync:', {
            skillsCount: skillsToSync.length,
            skills: skillsToSync,
            importEnabled: importSkills !== false
        })

        try {
            const settingsResponse = await axios.post(
                `${baseUrl}/api/projects/${resolvedRoomId}/settings`,
                {
                    settings: {
                        selectedComponents: skillsToSync,
                        selectedAgentSets: []
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    }
                }
            )

            console.log('[ClaudeWS Agentflow] Settings file created/updated successfully:', {
                file: '.claude/project-settings.json',
                selectedComponents: settingsResponse.data.settings?.selectedComponents || skillsToSync,
                projectId: resolvedRoomId
            })
        } catch (settingsError: any) {
            console.error('[ClaudeWS Agentflow] Failed to create settings file:', settingsError.response?.data || settingsError.message)
            // Continue anyway - settings might already exist
        }

        // Step 4: Sync skills to project (if enabled and skills selected)
        if (skillsToSync.length > 0) {
            console.log('[ClaudeWS Agentflow] Step 4: Syncing skills to project...')

            try {
                const syncResponse = await axios.post(
                    `${baseUrl}/api/agent-factory/projects/${resolvedRoomId}/sync`,
                    {
                        componentIds: skillsToSync,
                        agentSetIds: []
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        }
                    }
                )

                // Handle different response formats
                const responseData = syncResponse.data

                // Format 1: Detailed response { success, message, installed, skipped, errors }
                if (responseData && typeof responseData === 'object' && 'installed' in responseData) {
                    console.log('[ClaudeWS Agentflow] Skills sync completed (detailed format):', {
                        success: responseData.success,
                        installed: responseData.installed?.length || 0,
                        skipped: responseData.skipped?.length || 0,
                        errors: responseData.errors?.length || 0,
                        projectId: resolvedRoomId
                    })
                }
                // Format 2: Simple array response ["id1", "id2", ...]
                else if (Array.isArray(responseData)) {
                    console.log('[ClaudeWS Agentflow] Skills sync completed (array format):', {
                        installed: responseData.length,
                        ids: responseData,
                        projectId: resolvedRoomId
                    })
                }
                // Format 3: Unknown format, log raw response
                else {
                    console.log('[ClaudeWS Agentflow] Skills sync completed (unknown format):', {
                        response: responseData,
                        projectId: resolvedRoomId
                    })
                }
            } catch (syncError: any) {
                console.error('[ClaudeWS Agentflow] Error during skill sync:', syncError.response?.data || syncError.message)
                // Continue anyway - skills might already be installed
            }

            // Step 5: Verify installation
            try {
                console.log('[ClaudeWS Agentflow] Step 5: Verifying skill installation...')
                const verifyResponse = await axios.get(`${baseUrl}/api/agent-factory/projects/${resolvedRoomId}/installed`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    }
                })

                const installedData = verifyResponse.data
                console.log('[ClaudeWS Agentflow] Installation verification result:', {
                    totalInstalled: installedData.installed?.length || 0,
                    installed: installedData.installed || [],
                    projectId: resolvedRoomId
                })

                // Check if all requested skills are installed
                const missingSkills = skillsToSync.filter((skillId: string) => !installedData.installed?.includes(skillId))

                if (missingSkills.length > 0) {
                    console.warn('[ClaudeWS Agentflow] Some skills were not installed:', missingSkills)
                } else {
                    console.log('[ClaudeWS Agentflow] ✅ All requested skills verified successfully!')
                }
            } catch (verifyError: any) {
                console.error('[ClaudeWS Agentflow] Error during verification:', verifyError.response?.data || verifyError.message)
                // Continue anyway - verification is optional
            }
        } else {
            console.log('[ClaudeWS Agentflow] No skills to sync, skipping sync and verification steps')
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
                enabledSkills,
                serverId
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

    // Temporary newline to fix parsing
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
        enabledSkills?: string[],
        serverId?: string
    ): Promise<{ text: string; usedTools: any[] }> {
        return new Promise((resolve, reject) => {
            let fullResponse = ''
            let resolved = false
            let attemptId: string | null = null
            const usedTools: any[] = []

            const socket = io(baseUrl, {
                reconnection: false,
                auth: { 'x-api-key': apiKey },
                extraHeaders: { 'x-api-key': apiKey }
            })

            const cleanup = () => {
                socket.removeAllListeners()
                socket.disconnect()
            }

            socket.on(SocketEventNames.CONNECT, () => {
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
                socket.emit(SocketEventNames.ATTEMPT_START, attemptPayload)
            })

            socket.on(SocketEventNames.ATTEMPT_STARTED, (data: { attemptId: string }) => {
                attemptId = data.attemptId
                // Explicitly subscribe to attempt room to receive events
                socket.emit(SocketEventNames.ATTEMPT_SUBSCRIBE, { attemptId })
                console.log('[ClaudeWS Agentflow] Attempt started, socket ID:', socket.id, 'attemptId:', attemptId)
            })

            socket.on(SocketEventNames.CONNECT_ERROR, (err: Error) => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error(`Connection failed: ${err.message}`))
            })

            socket.on(SocketEventNames.OUTPUT_JSON, (data: { attemptId: string; data: ClaudeWSOutput }) => {
                // Only process messages for this attempt
                if (!attemptId || data.attemptId !== attemptId) {
                    return
                }

                const output = data.data

                switch (output.type) {
                    case ClaudeWSOutputEventTypes.CONTENT_BLOCK_DELTA:
                        if (output.delta?.type === ClaudeWSDeltaTypes.TEXT_DELTA && output.delta.text) {
                            fullResponse += output.delta.text
                            if (shouldStream && streamer && chatId) {
                                streamer.streamTokenEvent(chatId, output.delta.text)
                            }
                        } else if (output.delta?.type === ClaudeWSDeltaTypes.THINKING_DELTA && output.delta.thinking) {
                            if (shouldStream && streamer && chatId) {
                                streamer.streamThinkingEvent(chatId, output.delta.thinking)
                            }
                        }
                        break

                    case ClaudeWSOutputEventTypes.ASSISTANT:
                        // Complete assistant message - extract text from it
                        if ((output as any).message && (output as any).message.content) {
                            const content = (output as any).message.content
                            if (Array.isArray(content)) {
                                // Extract text and tool_use from content blocks
                                for (const block of content) {
                                    if (block.type === ClaudeWSContentBlockTypes.TEXT && block.text) {
                                        // Append to fullResponse (deltas are incremental)
                                        fullResponse += block.text
                                        if (shouldStream && streamer && chatId) {
                                            streamer.streamTokenEvent(chatId, block.text)
                                        }
                                    } else if (block.type === ClaudeWSContentBlockTypes.TOOL_USE) {
                                        // NEW: Stream tool_use event to client
                                        if (shouldStream && streamer && chatId) {
                                            streamer.streamToolUseEvent(chatId, {
                                                toolId: block.id,
                                                toolName: block.name,
                                                input: block.input,
                                                attemptId: attemptId!
                                            })
                                        }
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

                    case ClaudeWSOutputEventTypes.TOOL_USE:
                        // NEW: Stream standalone tool_use events
                        if (shouldStream && streamer && chatId) {
                            streamer.streamToolUseEvent(chatId, {
                                toolId: output.tool_name || 'unknown',
                                toolName: output.tool_name || 'unknown',
                                input: output.input || {},
                                attemptId: attemptId!
                            })
                        }
                        usedTools.push({
                            tool: output.tool_name || '',
                            toolInput: output.input || {},
                            toolOutput: ''
                        })
                        break

                    case ClaudeWSOutputEventTypes.USER:
                        // Check if this is a tool_result message
                        if ((output as any).message && (output as any).message.content) {
                            const content = (output as any).message.content
                            if (Array.isArray(content)) {
                                for (const block of content) {
                                    if (block.type === ClaudeWSContentBlockTypes.TOOL_RESULT) {
                                        // NEW: Stream tool_result event to client
                                        if (shouldStream && streamer && chatId) {
                                            streamer.streamToolResultEvent(chatId, {
                                                toolUseId: block.tool_use_id,
                                                result: block.content || 'Tool executed successfully',
                                                isError: block.is_error || false,
                                                attemptId: attemptId!
                                            })
                                        }
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

                    default:
                        // NEW: Catch-all for unknown event types
                        if (shouldStream && streamer && chatId) {
                            streamer.streamClaudeWSEvent(chatId, {
                                eventType: output.type,
                                attemptId: attemptId!,
                                payload: output
                            })
                        }
                        break
                }
            })

            socket.on(SocketEventNames.ATTEMPT_FINISHED, (data: { attemptId: string; status?: string; code?: number }) => {
                if (!attemptId || data.attemptId !== attemptId) return
                if (resolved) return

                console.log('[ClaudeWS] Attempt finished:', data)

                // NEW: Stream completion event to client
                if (shouldStream && streamer && chatId) {
                    streamer.streamClaudeWSEvent(chatId, {
                        eventType: 'attempt:finished',
                        attemptId: attemptId!,
                        payload: {
                            status: data.status || 'completed',
                            code: data.code || 0
                        }
                    })
                }

                // Clean up any pending questions for this attempt
                claudewsQuestionStorage.cleanupAttempt(attemptId)

                resolved = true
                cleanup()
                resolve({ text: fullResponse, usedTools })
            })

            socket.on(SocketEventNames.ERROR, (data: { message: string; code?: number }) => {
                if (resolved) return

                console.error('[ClaudeWS] Socket error:', data)

                // Stream error event to client
                if (shouldStream && streamer && chatId) {
                    streamer.streamClaudeWSEvent(chatId, {
                        eventType: 'error',
                        attemptId: attemptId || 'unknown',
                        payload: {
                            message: data.message,
                            code: data.code
                        }
                    })
                }

                resolved = true
                cleanup()
                reject(new Error(data.message))
            })

            // Handle question:ask event from ClaudeWS server
            socket.on(SocketEventNames.QUESTION_ASK, (data: QuestionAskData) => {
                console.log('[ClaudeWS Agentflow] Received question:ask event:', {
                    socketId: socket.id,
                    currentAttemptId: attemptId,
                    receivedAttemptId: data.attemptId,
                    toolUseId: data.toolUseId,
                    questionCount: data.questions?.length
                })

                // Only process questions for this attempt
                if (!attemptId || data.attemptId !== attemptId) {
                    console.warn('[ClaudeWS Agentflow] Skipping question - attemptId mismatch or not set')
                    return
                }

                // NO marker token - use only custom event for cleaner handling

                // Stream as custom event for chat UI to handle with modal
                if (shouldStream && streamer && chatId) {
                    // Check if streamQuestionEvent exists, fallback to usedTools
                    if (typeof streamer.streamQuestionEvent === 'function') {
                        streamer.streamQuestionEvent(chatId, {
                            attemptId: data.attemptId,
                            toolUseId: data.toolUseId,
                            questions: data.questions
                        })
                    } else {
                        // Fallback: use streamUsedToolsEvent with AskUserQuestion tool
                        console.warn('[ClaudeWS] streamQuestionEvent not available, using usedTools fallback')
                        streamer.streamUsedToolsEvent(chatId, [
                            {
                                tool: 'AskUserQuestion',
                                toolInput: {
                                    toolUseId: data.toolUseId,
                                    questions: data.questions
                                },
                                toolOutput: ''
                            }
                        ])
                    }
                }

                // Store questions on server for HTTP API access
                const apiBaseUrl = process.env.PRIVOS_API_BASE_URL || 'http://localhost:3002/api/v1'
                const questionsApiUrl = apiBaseUrl.endsWith('/api/v1')
                    ? `${apiBaseUrl}/claudews/questions`
                    : `${apiBaseUrl}/api/v1/claudews/questions`

                const serverIdForApi = (global as any).__claudews_server_id__

                fetch(questionsApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attemptId: data.attemptId,
                        toolUseId: data.toolUseId,
                        serverId: serverIdForApi || serverId,
                        questions: data.questions
                    })
                }).catch((err) => console.error('[ClaudeWS] Failed to store questions on server:', err))

                // END FLOW IMMEDIATELY - user will submit answers in new request
                console.log('[ClaudeWS Agentflow] Questions sent, ending flow. User will submit answers in next request.')

                // Set response with question info for frontend
                fullResponse = JSON.stringify({
                    type: 'questions',
                    attemptId: data.attemptId,
                    toolUseId: data.toolUseId,
                    questions: data.questions
                })

                // Clean up and resolve to end flow
                resolved = true
                cleanup()
                resolve({ text: fullResponse, usedTools })
            })

            // Timeout after 15 minutes
            setTimeout(() => {
                if (resolved) return
                resolved = true
                cleanup()
                reject(new Error('Attempt timeout'))
            }, DEFAULT_TIMEOUT_MS)
        })
    }

    /**
     * Submit user answer to a pending question
     * Call this from frontend when user answers a question
     *
     * @param attemptId - The attempt ID from the question
     * @param toolUseId - The tool use ID from the question
     * @param questionHeader - The header of the question being answered
     * @param answer - The user's answer (for multi-select, this is an array of labels)
     */
    submitAnswer(attemptId: string, toolUseId: string, questionHeader: string, answer: string | string[]): void {
        const key = `${attemptId}-${toolUseId}-${questionHeader}`
        const result = claudewsQuestionStorage.submitAnswer(key, answer)

        if (!result.success) {
            console.warn(`[ClaudeWS Agentflow] ${result.message}`)
        }
    }
}

module.exports = { nodeClass: ClaudeWS_Agentflow }
