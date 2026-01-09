import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    processTemplateVariables,
    secureAxiosRequest
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PRIVOS_ENDPOINTS } from '../constants'
import { PrivosErrorHandler } from '../utils'

class GetUserInfo_Privos implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    color: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]
    output?: INodeOutputsValue[] | undefined

    constructor() {
        this.label = 'Get User Info'
        this.name = 'getUserInfoPrivos'
        this.version = 1.0
        this.type = 'UserProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch user info from Privos API'
        this.icon = 'privos.svg'
        this.color = '#4318FF'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi']
        }
        this.inputs = [
            {
                label: 'User ID',
                name: 'userId',
                type: 'string',
                acceptVariable: true
            },
            {
                label: 'Update Flow State',
                name: 'updateFLowState',
                description: 'Update runtime state during the execution of the workflow',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'asyncOptions',
                        loadMethod: 'listRuntimeStateKeys',
                        freeSolo: true
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true,
                        acceptNodeOutputAsVariable: true
                    }
                ]
            }
        ]
        this.output = [
            {
                label: 'Result Data',
                name: 'result',
                baseClasses: [this.type, 'string', 'object']
            }
        ]
    }

    private async fetchUserData(baseUrl: string, apiKey: string, userId: string) {
        const headers = { 'X-API-KEY': apiKey }

        const res = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.USERS}`,
            headers
            // params: { userId }
        })
        const data = res.data?.users || []
        const targetUser = data.find((u: any) => u._id === userId)
        if (!targetUser) return { success: false, error: `User ${userId} not found` }

        return targetUser
    }

    private async fetchRoomData(baseUrl: string, apiKey: string) {
        const headers = { 'X-API-KEY': apiKey }

        // count=0 to get all, include channels, private rooms, and teams
        const res = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.ROOMS}?count=0&types[]=p&types[]=c&types[]=teams`,
            headers
        })
        const data = res.data?.rooms || []

        return data
    }

    private async fetchListData(baseUrl: string, apiKey: string) {
        const headers = { 'X-API-KEY': apiKey }

        const res = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.LISTS}.list`,
            headers
        })
        const data = res.data?.lists || []

        return data
    }

    private async fetchListDetailData(baseUrl: string, apiKey: string, listId: string) {
        const headers = { 'X-API-KEY': apiKey }

        const res = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.LISTS}/${encodeURIComponent(listId)}`,
            headers
        })
        return res.data
    }

    //@ts-ignore
    loadMethods = {
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { userId, updateFLowState } = nodeData.inputs as ICommonObject
        if (!userId) throw new Error('User ID is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const userInfo = await this.fetchUserData(baseUrl, apiKey, userId)
            const rooms = await this.fetchRoomData(baseUrl, apiKey)
            const { roomMap } = this.handleRoomMapAndChannel(rooms)
            const lists = await this.fetchListData(baseUrl, apiKey)
            const { tasksByRoom, allTasks } = await this.collectUserTasks(userId, roomMap, lists, baseUrl, apiKey)

            const userName = userInfo.username || userInfo.name || ''
            const result: any = {
                user: {
                    id: userId,
                    username: userName
                },
                totalTasks: allTasks.length,
                byRoom: tasksByRoom
            }

            // Update flow state if needed
            let newState = { ...state }
            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(state, updateFLowState)
            }
            newState = processTemplateVariables(newState, result)

            return {
                id: nodeData.id,
                name: this.name,
                input: { userId },
                output: { content: JSON.stringify(result, null, 2) },
                state: newState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }

    private handleRoomMapAndChannel(rooms: any[]) {
        const roomMap: any = { GENERAL: 'General' }

        // First pass: Group channels by teamId to find the main team name
        const teamChannels: any = {} // teamId -> array of channels
        rooms.forEach((room: any) => {
            if (room._id && room.t !== 'd') {
                // Map by room._id first
                const displayName = room.fname || room.name || room._id
                roomMap[room._id] = displayName

                // Group channels by teamId
                if (room.teamId) {
                    if (!teamChannels[room.teamId]) {
                        teamChannels[room.teamId] = []
                    }
                    teamChannels[room.teamId].push({
                        _id: room._id,
                        fname: room.fname,
                        name: room.name,
                        ts: room.ts // creation timestamp
                    })
                }
            }
        })

        // Second pass: Map teamId to team name
        // Strategy: Use the first channel created (oldest) as the team's main channel name
        // OR find the channel whose name matches the team pattern
        for (const teamId in teamChannels) {
            const channels = teamChannels[teamId]
            // Sort by creation time (oldest first)
            channels.sort((a: any, b: any) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

            // Use the first (oldest) channel's name as the team name
            // This is typically the team's main/general channel
            const mainChannel = channels[0]
            const teamDisplayName = mainChannel.fname || mainChannel.name || teamId

            roomMap[teamId] = teamDisplayName
        }

        return { roomMap, teamChannels }
    }

    private async collectUserTasks(userId: string, roomMap: any, lists: any[], baseUrl: string, apiKey: string) {
        // Structure: { byRoom: {}, byStage: {}, allTasks: [] }
        const tasksByRoom: any = {}
        const tasksByStage: any = {}
        const allTasks: any = []

        for (const listSummary of lists) {
            const listId = listSummary._id
            const listName = listSummary.name || 'Unnamed'
            const roomId = listSummary.roomId || 'GENERAL'
            const roomName = roomMap[roomId] || roomId

            const listData = await this.fetchListDetailData(baseUrl, apiKey, listId)
            if (!listData) continue

            const fieldDefinitions = listData?.list?.fieldDefinitions || []
            const stages = listData?.stages || []
            const items = listData?.items || []

            // Find assignee field
            let assigneeFieldId = null
            for (const field of fieldDefinitions) {
                const fieldType = (field.type || '').toUpperCase()
                if (fieldType === 'USER' || fieldType === 'ASSIGNEE') {
                    assigneeFieldId = field._id
                    break
                }
            }

            // Find date field
            let dueDateFieldId = null
            for (const field of fieldDefinitions) {
                const fieldType = (field.type || '').toUpperCase()
                const fieldName = (field.name || '').toLowerCase()
                if (fieldType === 'DATE' || fieldType === 'DATE_TIME' || fieldType === 'DEADLINE') {
                    if (fieldName.includes('due') || fieldName.includes('deadline') || !dueDateFieldId) {
                        dueDateFieldId = field._id
                    }
                }
            }

            // Detect from items if needed
            if (!assigneeFieldId && items.length > 0) {
                for (const item of items) {
                    for (const cf of item.customFields || []) {
                        if (Array.isArray(cf.value) && cf.value.length > 0) {
                            const first = cf.value[0]
                            if (first && first._id && (first.username || first.name)) {
                                assigneeFieldId = cf.fieldId
                                break
                            }
                        }
                    }
                    if (assigneeFieldId) break
                }
            }

            const stageMap: any = {}
            stages.forEach((s: any) => {
                stageMap[s._id] = s.name || 'Unknown'
            })

            // Process items - ONLY for target user
            for (const item of items) {
                const customFields = item.customFields || []
                const stageName = stageMap[item.stageId] || 'Unknown'

                // Check if target user is assignee
                let isAssignedToUser = false
                if (assigneeFieldId) {
                    const assigneeField = customFields.find((cf: any) => cf.fieldId === assigneeFieldId)
                    if (assigneeField && Array.isArray(assigneeField.value)) {
                        isAssignedToUser = assigneeField.value.some((u: any) => u._id === userId)
                    }
                }

                // Skip if not assigned to target user
                if (!isAssignedToUser) continue

                // Get due date
                let dueDate = null
                if (dueDateFieldId) {
                    const dueDateField = customFields.find((cf: any) => cf.fieldId === dueDateFieldId)
                    if (dueDateField && dueDateField.value) {
                        dueDate = this.formatDate(dueDateField.value)
                    }
                }

                // Create task object
                const taskObj = {
                    name: item.name || 'Untitled',
                    room: roomName,
                    list: listName,
                    stage: stageName,
                    dueDate: dueDate
                }

                allTasks.push(taskObj)

                // Group by room
                if (!tasksByRoom[roomName]) tasksByRoom[roomName] = {}
                if (!tasksByRoom[roomName][listName]) tasksByRoom[roomName][listName] = {}
                if (!tasksByRoom[roomName][listName][stageName]) tasksByRoom[roomName][listName][stageName] = []
                tasksByRoom[roomName][listName][stageName].push(taskObj)

                // Group by stage
                if (!tasksByStage[stageName]) tasksByStage[stageName] = []
                tasksByStage[stageName].push(taskObj)
            }
        }

        return { tasksByRoom, tasksByStage, allTasks }
    }

    private formatDate(dateValue: any) {
        if (!dateValue) return null
        try {
            const date = new Date(dateValue)
            if (isNaN(date.getTime())) return null
            return date.toISOString().split('T')[0]
        } catch (e) {
            return null
        }
    }
}

module.exports = { nodeClass: GetUserInfo_Privos }
