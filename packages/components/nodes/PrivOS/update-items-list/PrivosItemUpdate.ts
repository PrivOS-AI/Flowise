import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue, IFileUpload } from '../../../src/Interface'
import { getCredentialData } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'
import { getFileFromStorage } from '../../../src/storageUtils'
import {
    CACHE_TTL,
    PRIVOS_ENDPOINTS,
    PRIVOS_HEADERS,
    CONTENT_TYPES,
    DEFAULT_PRIVOS_API_BASE_URL,
    REQUEST_CONFIG,
    ROOM_TYPES,
    PRIVOS_FIELD_IDS
} from '../constants'
import { uploadFileToPrivos, getMimeTypeFromFilename } from '../utils'

// Global cache for rooms
const roomsCacheUpdateItem: Map<string, { rooms: any[]; timestamp: number }> = new Map()

// Global cache for field definitions
const fieldDefinitionsCache: Map<string, any[]> = new Map()

async function fetchRoomsFromAPI(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
    try {
        const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ROOMS_GET}`
        const response = await secureAxiosRequest({
            method: 'GET',
            url: apiUrl,
            headers: {
                [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                [PRIVOS_HEADERS.USER_ID]: userId,
                [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
            }
        })
        return response.data?.update || []
    } catch (error: any) {
        console.error('Error fetching rooms:', error.message)
        throw error
    }
}

class PrivosItemUpdate_Agentflow implements INode {
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

    constructor() {
        this.label = 'Update Item in List'
        this.name = 'privosItemUpdate'
        this.version = 2.0
        this.type = 'PrivosItemUpdate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#FF5722'
        this.description = 'Update an existing item in a list with full field support'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi']
        }
        this.inputs = [
            {
                label: 'Select Room',
                name: 'selectedRoom',
                type: 'asyncOptions',
                loadMethod: 'listRooms',
                refresh: true,
                description: 'Select a room to view its lists'
            },
            {
                label: 'Select List',
                name: 'selectedList',
                type: 'asyncOptions',
                loadMethod: 'listLists',
                refresh: true,
                description: 'Select a list to view its stages'
            },
            {
                label: 'Select Stage',
                name: 'selectedStage',
                type: 'asyncOptions',
                loadMethod: 'listStages',
                refresh: true,
                optional: true,
                description: 'Filter items by stage (leave empty to show all items)'
            },
            {
                label: 'Select Item to Update',
                name: 'selectedItem',
                type: 'asyncOptions',
                loadMethod: 'listItems',
                refresh: true,
                description: 'Select the item you want to update. Current values will auto-fill below.',
                autoFillConfig: {
                    fieldsToFill: [
                        {
                            targetField: 'itemName',
                            sourcePath: 'name'
                        },
                        {
                            targetField: 'itemDescription',
                            sourcePath: 'description'
                        },
                        // Marketing fields
                        {
                            targetField: 'current_marketing_file_url',
                            sourcePath: 'current_marketing_file_url'
                        },
                        {
                            targetField: 'field_marketing_assignees',
                            sourcePath: 'field_marketing_assignees'
                        },
                        {
                            targetField: 'field_marketing_due_date',
                            sourcePath: 'field_marketing_due_date'
                        },
                        {
                            targetField: 'field_marketing_start_date',
                            sourcePath: 'field_marketing_start_date'
                        },
                        {
                            targetField: 'field_marketing_end_date',
                            sourcePath: 'field_marketing_end_date'
                        },
                        {
                            targetField: 'field_marketing_file',
                            sourcePath: 'field_marketing_file'
                        },
                        {
                            targetField: 'field_marketing_documents',
                            sourcePath: 'field_marketing_documents'
                        },
                        {
                            targetField: 'field_marketing_note',
                            sourcePath: 'field_marketing_note'
                        },
                        // Recruitment fields
                        {
                            targetField: 'current_recruitment_cv_url',
                            sourcePath: 'current_recruitment_cv_url'
                        },
                        {
                            targetField: 'field_recruitment_cv',
                            sourcePath: 'field_recruitment_cv'
                        },
                        {
                            targetField: 'field_recruitment_ai_summary',
                            sourcePath: 'field_recruitment_ai_summary'
                        },
                        {
                            targetField: 'field_recruitment_ai_score',
                            sourcePath: 'field_recruitment_ai_score'
                        },
                        {
                            targetField: 'field_recruitment_interview_time',
                            sourcePath: 'field_recruitment_interview_time'
                        },
                        {
                            targetField: 'field_recruitment_interviewer',
                            sourcePath: 'field_recruitment_interviewer'
                        },
                        {
                            targetField: 'field_recruitment_interview_questions',
                            sourcePath: 'field_recruitment_interview_questions'
                        },
                        {
                            targetField: 'field_recruitment_interview_notes',
                            sourcePath: 'field_recruitment_interview_notes'
                        },
                        {
                            targetField: 'field_recruitment_interview_score',
                            sourcePath: 'field_recruitment_interview_score'
                        },
                        {
                            targetField: 'field_recruitment_trial_time',
                            sourcePath: 'field_recruitment_trial_time'
                        },
                        {
                            targetField: 'field_recruitment_cv_content',
                            sourcePath: 'field_recruitment_cv_content'
                        }
                    ]
                }
            },
            {
                label: 'Item Name',
                name: 'itemName',
                type: 'string',
                placeholder: 'Enter new item name or {{$flow.itemName}}',
                acceptVariable: true,
                optional: true,
                description: 'Update item name (leave empty to keep current)'
            },
            {
                label: 'Item Description',
                name: 'itemDescription',
                type: 'string',
                rows: 4,
                placeholder: 'Enter new description or {{$flow.description}}',
                acceptVariable: true,
                optional: true,
                description: 'Update item description (leave empty to keep current)'
            },
            // === MARKETING LIST FIELDS (7 fields) ===
            {
                label: '1. Assignees',
                name: 'field_marketing_assignees',
                type: 'asyncOptions',
                loadMethod: 'listUsers',
                list: true,
                optional: true,
                description: 'Update assigned users (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '2. Due Date',
                name: 'field_marketing_due_date',
                type: 'date',
                optional: true,
                description: 'Update due date (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '3. Start Date',
                name: 'field_marketing_start_date',
                type: 'date',
                optional: true,
                description: 'Update start date (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '4. End Date',
                name: 'field_marketing_end_date',
                type: 'date',
                optional: true,
                description: 'Update end date (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '5a. Current File (Click URL to Open)',
                name: 'current_marketing_file_url',
                type: 'string',
                optional: true,
                placeholder: 'No file - will show URL after selecting item',
                description: 'READ-ONLY: Click or copy URL to view current file',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '5b. Upload New File (Optional)',
                name: 'field_marketing_file',
                type: 'file',
                optional: true,
                description: 'Upload a new file to replace the current one (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '6. Documents',
                name: 'field_marketing_documents',
                type: 'array',
                acceptVariable: true,
                optional: true,
                description: 'Update documents with title and content (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                },
                array: [
                    {
                        label: 'Title',
                        name: 'title',
                        type: 'string',
                        placeholder: 'Document title',
                        acceptVariable: true
                    },
                    {
                        label: 'Content',
                        name: 'content',
                        type: 'string',
                        rows: 3,
                        placeholder: 'Document content',
                        acceptVariable: true
                    }
                ]
            },
            {
                label: '7. Note',
                name: 'field_marketing_note',
                type: 'string',
                rows: 4,
                optional: true,
                placeholder: 'Enter updated notes',
                description: 'Update notes (leave empty to keep current)',
                show: {
                    selectedList: 'marketing'
                }
            },
            // === HR/RECRUITMENT LIST FIELDS (10 fields) ===
            {
                label: '1a. Current CV (Click URL to Open)',
                name: 'current_recruitment_cv_url',
                type: 'string',
                optional: true,
                placeholder: 'No CV - will show URL after selecting item',
                description: 'READ-ONLY: Click or copy URL to view current CV',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '1b. Upload New CV (Optional)',
                name: 'field_recruitment_cv',
                type: 'file',
                optional: true,
                description: 'Upload a new CV to replace the current one (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '2. AI Summary',
                name: 'field_recruitment_ai_summary',
                type: 'string',
                rows: 4,
                optional: true,
                placeholder: 'Enter updated AI summary',
                description: 'Update AI summary (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '3. AI Score',
                name: 'field_recruitment_ai_score',
                type: 'number',
                optional: true,
                placeholder: 'Enter updated AI score',
                description: 'Update AI score (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '4. Interview Time',
                name: 'field_recruitment_interview_time',
                type: 'date',
                optional: true,
                description: 'Update interview time (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '5. Interviewer',
                name: 'field_recruitment_interviewer',
                type: 'asyncOptions',
                loadMethod: 'listUsers',
                list: true,
                optional: true,
                description: 'Update interviewer(s) (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '6. Interview Questions',
                name: 'field_recruitment_interview_questions',
                type: 'string',
                rows: 4,
                optional: true,
                placeholder: 'Enter updated interview questions',
                description: 'Update interview questions (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '7. Interview Notes',
                name: 'field_recruitment_interview_notes',
                type: 'string',
                rows: 4,
                optional: true,
                placeholder: 'Enter updated interview notes',
                description: 'Update interview notes (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '8. Interview Score',
                name: 'field_recruitment_interview_score',
                type: 'number',
                optional: true,
                placeholder: 'Enter updated interview score',
                description: 'Update interview score (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '9. Trial Time',
                name: 'field_recruitment_trial_time',
                type: 'date',
                optional: true,
                description: 'Update trial time (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '10. CV Content',
                name: 'field_recruitment_cv_content',
                type: 'string',
                rows: 6,
                optional: true,
                placeholder: 'Enter updated CV content',
                description: 'Update CV content (leave empty to keep current)',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            // === MOVE TO STAGE ===
            {
                label: 'Move to Stage (Optional)',
                name: 'moveToStage',
                type: 'asyncOptions',
                loadMethod: 'listStages',
                optional: true,
                description: 'Select a new stage to move this item to. Leave empty to keep current stage.'
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listRooms(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                const credentialId = nodeData.credential || ''
                if (!credentialId) return returnData

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData || Object.keys(credentialData).length === 0) return returnData

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) return returnData

                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()
                const cached = roomsCacheUpdateItem.get(cacheKey)

                let rooms: any[]
                if (cached && now - cached.timestamp < CACHE_TTL) {
                    rooms = cached.rooms
                } else {
                    rooms = await fetchRoomsFromAPI(baseUrl, userId, authToken)
                    roomsCacheUpdateItem.set(cacheKey, { rooms, timestamp: now })
                }

                for (const room of rooms) {
                    const roomName = room.fname || room.name || room._id
                    const roomType = room.t === 'd' ? 'Direct' : room.t === 'p' ? 'Private' : 'Public'

                    returnData.push({
                        label: `${roomName} (${roomType})`,
                        name: room._id,
                        description: `${room.msgs || 0} messages`
                    })
                }

                return returnData
            } catch (error: any) {
                console.error('[listRooms] Error:', error.message)
                return returnData
            }
        },

        async listLists(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listLists] START')

                const selectedRoom = nodeData.inputs?.selectedRoom as string
                console.log('[listLists] selectedRoom:', selectedRoom)

                if (!selectedRoom) {
                    console.log('[listLists] No room selected')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('[listLists] No credential')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) {
                    console.error('[listLists] No credential data')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('[listLists] Missing userId or authToken')
                    return returnData
                }

                const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LISTS_BY_ROOM_ID}`
                console.log('[listLists] API URL:', apiUrl, 'roomId:', selectedRoom)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                        [PRIVOS_HEADERS.USER_ID]: userId,
                        [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                    },
                    params: {
                        roomId: selectedRoom,
                        offset: REQUEST_CONFIG.DEFAULT_OFFSET,
                        count: REQUEST_CONFIG.DEFAULT_COUNT
                    }
                })

                const lists = response.data?.lists || []
                console.log('[listLists] Found', lists.length, 'lists')

                // Store roomId, listName and templateKey in each list option and cache fieldDefinitions
                for (const list of lists) {
                    returnData.push({
                        label: list.name || list._id,
                        name: JSON.stringify({
                            listId: list._id,
                            listName: list.name,
                            templateKey: list.templateKey || '',
                            roomId: list.roomId || selectedRoom
                        }),
                        description: list.description || `${list.stageCount || 0} stages, ${list.itemCount || 0} items`
                    })

                    // Cache field definitions directly from response (no need for extra API call!)
                    if (list.fieldDefinitions && list.fieldDefinitions.length > 0) {
                        fieldDefinitionsCache.set(list._id, list.fieldDefinitions)
                        console.log('[listLists] Cached', list.fieldDefinitions.length, 'field definitions for list', list._id, list.name)
                        console.log('[listLists] Field types:', list.fieldDefinitions.map((f: any) => `${f.name}(${f.type})`).join(', '))
                    } else {
                        console.log('[listLists] No fieldDefinitions for list', list._id, list.name)
                    }
                }

                console.log('[listLists] Returning', returnData.length, 'list options')
                return returnData
            } catch (error: any) {
                console.error('[listLists] Error:', error.message)
                console.error('[listLists] Error details:', error.response?.data || 'No response data')
                return returnData
            }
        },

        async listStages(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listStages] START')

                const selectedListStr = nodeData.inputs?.selectedList as string
                console.log('[listStages] selectedList:', selectedListStr)

                if (!selectedListStr) {
                    console.log('[listStages] No list selected')
                    return returnData
                }

                // Parse selectedList to get listId
                let listId: string
                try {
                    const parsed = JSON.parse(selectedListStr)
                    listId = parsed.listId
                    console.log('[listStages] Parsed listId:', listId)
                } catch (e) {
                    listId = selectedListStr
                    console.log('[listStages] Using listId directly:', listId)
                }

                if (!listId) {
                    console.error('[listStages] No listId found')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) return returnData

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) return returnData

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) return returnData

                // Get list details to fetch stages
                const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LIST_DETAIL}/${listId}`
                console.log('[listStages] Fetching list details from:', apiUrl)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                        [PRIVOS_HEADERS.USER_ID]: userId,
                        [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                    }
                })

                const stages = response.data?.stages || []
                console.log('[listStages] Stages found:', stages.length)

                // Sort stages by order
                stages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))

                for (const stage of stages) {
                    returnData.push({
                        label: stage.name,
                        name: stage._id,
                        description: `Order: ${stage.order}${stage.color ? ` | Color: ${stage.color}` : ''}`
                    })
                }

                console.log('[listStages] Returning', returnData.length, 'stage options')
                return returnData
            } catch (error: any) {
                console.error('[listStages] Error:', error.message)
                console.error('[listStages] Error details:', error.response?.data || 'No response data')
                return returnData
            }
        },

        async listItems(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listItems] START')

                const selectedListStr = nodeData.inputs?.selectedList as string
                console.log('[listItems] selectedList:', selectedListStr)

                if (!selectedListStr) {
                    console.log('[listItems] No list selected')
                    return returnData
                }

                // Parse selectedList to get listId and roomId
                let listId: string
                let roomId: string
                try {
                    const parsed = JSON.parse(selectedListStr)
                    listId = parsed.listId
                    roomId = parsed.roomId
                    console.log('[listItems] Parsed - listId:', listId, 'roomId:', roomId)
                } catch (e) {
                    // Fallback: treat as listId only
                    listId = selectedListStr
                    roomId = nodeData.inputs?.selectedRoom as string
                    console.log('[listItems] Not JSON, using listId:', listId, 'roomId:', roomId)
                }

                if (!listId) {
                    console.error('[listItems] No listId found')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) return returnData

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) return returnData

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) return returnData

                // Check if stage is selected to filter items
                const selectedStage = nodeData.inputs?.selectedStage as string
                console.log('[listItems] selectedStage:', selectedStage)

                let apiUrl: string
                let apiParams: any

                if (selectedStage) {
                    // Use byStageId endpoint to get items in specific stage
                    apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_BY_STAGE_ID}`
                    apiParams = {
                        stageId: selectedStage,
                        limit: 100
                    }
                    console.log('[listItems] Fetching items by stageId:', selectedStage)
                } else {
                    // Use byListId endpoint to get all items in list
                    apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_BY_LIST_ID}`
                    apiParams = {
                        listId: listId,
                        offset: 0,
                        count: 100
                    }
                    console.log('[listItems] Fetching all items in listId:', listId)
                }

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                        [PRIVOS_HEADERS.USER_ID]: userId,
                        [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                    },
                    params: apiParams
                })

                const items = response.data?.items || []
                const stageName = response.data?.stageName || ''
                console.log('[listItems] Found', items.length, 'items', selectedStage ? `in stage: ${stageName}` : 'in list')

                for (const item of items) {
                    // Build rich formatted info text for display
                    const customFields = item.customFields || []

                    // Extract 7 hardcoded fields from customFields
                    const assigneesField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_assignees_field')
                    const dueDateField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_due_date_field')
                    const startDateField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_start_date_field')
                    const endDateField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_end_date_field')
                    const fileField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_file_link_field')
                    const documentsField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_documents_field')
                    const noteField = customFields.find((f: any) => f.fieldId === 'marketing_campaign_note_field')

                    // Build rich formatted text
                    let formattedInfo = `📋 Item: ${item.name || item._id}\n`
                    formattedInfo += `📝 Description: ${item.description || 'No description'}\n\n`
                    formattedInfo += '📊 CURRENT VALUES:\n'
                    formattedInfo += '═'.repeat(50) + '\n'

                    // Format each field
                    if (assigneesField?.value && Array.isArray(assigneesField.value)) {
                        const usernames = assigneesField.value.map((u: any) => u.username || u._id).join(', ')
                        formattedInfo += `🔹 Assignees: ${usernames}\n`
                    } else {
                        formattedInfo += '🔸 Assignees: (empty)\n'
                    }

                    if (dueDateField?.value) {
                        const date = new Date(dueDateField.value).toLocaleDateString('en-GB')
                        formattedInfo += `🔹 Due Date: ${date}\n`
                    } else {
                        formattedInfo += '🔸 Due Date: (empty)\n'
                    }

                    if (startDateField?.value) {
                        const date = new Date(startDateField.value).toLocaleDateString('en-GB')
                        formattedInfo += `🔹 Start Date: ${date}\n`
                    } else {
                        formattedInfo += '🔸 Start Date: (empty)\n'
                    }

                    if (endDateField?.value) {
                        const date = new Date(endDateField.value).toLocaleDateString('en-GB')
                        formattedInfo += `🔹 End Date: ${date}\n`
                    } else {
                        formattedInfo += '🔸 End Date: (empty)\n'
                    }

                    if (fileField?.value?.name) {
                        const sizeKB = (fileField.value.size / 1024).toFixed(1)
                        formattedInfo += `🔹 File: ${fileField.value.name} (${sizeKB} KB)\n`
                    } else {
                        formattedInfo += '🔸 File: (empty)\n'
                    }

                    if (documentsField?.value && Array.isArray(documentsField.value)) {
                        const titles = documentsField.value.map((d: any) => d.title).join(', ')
                        formattedInfo += `🔹 Documents: ${titles}\n`
                    } else {
                        formattedInfo += '🔸 Documents: (empty)\n'
                    }

                    if (noteField?.value) {
                        formattedInfo += `🔹 Note: ${noteField.value}\n`
                    } else {
                        formattedInfo += '🔸 Note: (empty)\n'
                    }

                    // Count other custom fields
                    const otherFields = customFields.filter(
                        (f: any) =>
                            f.fieldId !== 'marketing_campaign_assignees_field' &&
                            f.fieldId !== 'marketing_campaign_due_date_field' &&
                            f.fieldId !== 'marketing_campaign_start_date_field' &&
                            f.fieldId !== 'marketing_campaign_end_date_field' &&
                            f.fieldId !== 'marketing_campaign_file_link_field' &&
                            f.fieldId !== 'marketing_campaign_documents_field' &&
                            f.fieldId !== 'marketing_campaign_note_field'
                    )
                    if (otherFields.length > 0) {
                        formattedInfo += `\n+${otherFields.length} additional custom field(s)`
                    }

                    // Flatten customFields for auto-fill support
                    // Map field IDs to friendly input names
                    const flattenedFields: any = {}
                    for (const cf of customFields) {
                        switch (cf.fieldId) {
                            // Marketing fields
                            case PRIVOS_FIELD_IDS.MARKETING.ASSIGNEES:
                                flattenedFields.field_marketing_assignees = cf.value
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.DUE_DATE:
                                flattenedFields.field_marketing_due_date = cf.value
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.START_DATE:
                                flattenedFields.field_marketing_start_date = cf.value
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.END_DATE:
                                flattenedFields.field_marketing_end_date = cf.value
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.FILE:
                                flattenedFields.field_marketing_file = cf.value
                                // Populate URL for auto-fill
                                if (cf.value && cf.value.url) {
                                    const fullUrl = cf.value.url.startsWith('http')
                                        ? cf.value.url
                                        : `${baseUrl.replace('/api/v1', '')}${cf.value.url}`
                                    flattenedFields.current_marketing_file_url = fullUrl
                                }
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.DOCUMENTS:
                                flattenedFields.field_marketing_documents = cf.value
                                break
                            case PRIVOS_FIELD_IDS.MARKETING.NOTE:
                                flattenedFields.field_marketing_note = cf.value
                                break
                            // Recruitment fields
                            case PRIVOS_FIELD_IDS.RECRUITMENT.CV:
                                flattenedFields.field_recruitment_cv = cf.value
                                // Populate URL for auto-fill
                                if (cf.value && cf.value.url) {
                                    const fullUrl = cf.value.url.startsWith('http')
                                        ? cf.value.url
                                        : `${baseUrl.replace('/api/v1', '')}${cf.value.url}`
                                    flattenedFields.current_recruitment_cv_url = fullUrl
                                }
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.AI_SUMMARY:
                                flattenedFields.field_recruitment_ai_summary = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.AI_SCORE:
                                flattenedFields.field_recruitment_ai_score = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_TIME:
                                flattenedFields.field_recruitment_interview_time = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEWER:
                                flattenedFields.field_recruitment_interviewer = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_QUESTIONS:
                                flattenedFields.field_recruitment_interview_questions = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_NOTES:
                                flattenedFields.field_recruitment_interview_notes = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_SCORE:
                                flattenedFields.field_recruitment_interview_score = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.TRIAL_TIME:
                                flattenedFields.field_recruitment_trial_time = cf.value
                                break
                            case PRIVOS_FIELD_IDS.RECRUITMENT.CV_CONTENT:
                                flattenedFields.field_recruitment_cv_content = cf.value
                                break
                        }
                    }

                    // Augment item with roomId, formatted info, and flattened fields for later use
                    const itemWithExtras = {
                        ...item,
                        __roomId: roomId, // Store roomId for listUsers to access
                        __formattedInfo: formattedInfo, // Store formatted info
                        ...flattenedFields // Flatten custom fields for auto-fill
                    }

                    // Store full item data (with roomId and formatted info) in the name field as JSON string
                    // Build compact description for dropdown
                    const shortDesc = [
                        assigneesField?.value && Array.isArray(assigneesField.value) ? `👥 ${assigneesField.value.length}` : '👥 0',
                        dueDateField?.value ? `${new Date(dueDateField.value).toLocaleDateString('en-GB')}` : '📅 -',
                        fileField?.value ? ' ✓' : ' ✗',
                        documentsField?.value && Array.isArray(documentsField.value) ? `📄 ${documentsField.value.length}` : '📄 0'
                    ].join(' | ')

                    returnData.push({
                        label: item.name || item._id,
                        name: JSON.stringify(itemWithExtras), // Store full item data
                        description: shortDesc
                    })
                }

                console.log('[listItems] Returning', returnData.length, 'item options')
                return returnData
            } catch (error: any) {
                console.error('[listItems] Error:', error.message)
                return returnData
            }
        },

        async listUsers(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listUsers] START')

                // Try to get roomId from selectedItem first (which contains __roomId)
                // Otherwise fallback to selectedRoom
                let roomId: string | undefined

                const selectedItemStr = nodeData.inputs?.selectedItem as string
                if (selectedItemStr) {
                    try {
                        const itemData = JSON.parse(selectedItemStr)
                        roomId = itemData.__roomId
                        console.log('[listUsers] Got roomId from selectedItem:', roomId)
                    } catch (e) {
                        console.log('[listUsers] Could not parse selectedItem')
                    }
                }

                // Fallback to selectedRoom
                if (!roomId) {
                    roomId = nodeData.inputs?.selectedRoom as string
                    console.log('[listUsers] Using selectedRoom as fallback:', roomId)
                }

                if (!roomId) {
                    console.log('[listUsers] No roomId available')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('[listUsers] No credential ID')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) {
                    console.error('[listUsers] No credential data')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('[listUsers] Missing userId or authToken')
                    return returnData
                }

                // First, get room details to determine room type
                const cacheKey = `${userId}_${authToken}`
                const cached = roomsCacheUpdateItem.get(cacheKey)
                let rooms: any[] = []

                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    rooms = cached.rooms
                } else {
                    rooms = await fetchRoomsFromAPI(baseUrl, userId, authToken)
                    roomsCacheUpdateItem.set(cacheKey, { rooms, timestamp: Date.now() })
                }

                const room = rooms.find((r: any) => r._id === roomId)
                const roomType = room?.t || 'c' // Default to channel if not found

                console.log('[listUsers] Room type:', roomType, 'for room:', roomId)

                // Determine correct endpoint based on room type
                // c = channel (public), p = private group, d = direct message
                let apiEndpoint: string

                switch (roomType) {
                    case ROOM_TYPES.PRIVATE: // Private group
                        apiEndpoint = `${baseUrl}${PRIVOS_ENDPOINTS.GROUPS_MEMBERS}`
                        console.log('[listUsers] Using groups.members for private group')
                        break
                    case ROOM_TYPES.DIRECT: // Direct message
                        apiEndpoint = `${baseUrl}${PRIVOS_ENDPOINTS.IM_MEMBERS}`
                        console.log('[listUsers] Using im.members for direct message')
                        break
                    case ROOM_TYPES.CHANNEL: // Public channel
                    default:
                        apiEndpoint = `${baseUrl}${PRIVOS_ENDPOINTS.CHANNELS_MEMBERS}`
                        console.log('[listUsers] Using channels.members for public channel')
                        break
                }

                console.log('[listUsers] Fetching from:', apiEndpoint, 'with roomId:', roomId)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiEndpoint,
                    headers: {
                        [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                        [PRIVOS_HEADERS.USER_ID]: userId,
                        [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                    },
                    params: {
                        roomId: roomId,
                        offset: 0,
                        count: 100
                    }
                })

                const members = response.data?.members || []
                console.log('[listUsers] Members found:', members.length)

                for (const member of members) {
                    const displayName = member.name || member.username || member._id
                    returnData.push({
                        label: displayName,
                        name: JSON.stringify({ _id: member._id, username: member.username || member.name }),
                        description: member.username ? `@${member.username}` : ''
                    })
                }

                console.log('[listUsers] Returning', returnData.length, 'user options')
                return returnData
            } catch (error: any) {
                console.error('[listUsers] Error:', error.message)
                console.error('[listUsers] Error details:', error.response?.data || error.response || 'No response data')
                console.error('[listUsers] Error status:', error.response?.status || 'No status')
                return returnData
            }
        },

        async listFieldDefinitions(nodeData: INodeData): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listFieldDefinitions] ========== START ==========')
                console.log('[listFieldDefinitions] nodeData.inputs:', JSON.stringify(nodeData.inputs, null, 2))

                // Try to get selectedList from nodeData.inputs
                let selectedListStr = nodeData.inputs?.selectedList as string
                let selectedListId: string | undefined

                if (selectedListStr) {
                    try {
                        // Parse selectedList if it's JSON (contains listId and roomId)
                        const parsed = JSON.parse(selectedListStr)
                        selectedListId = parsed.listId
                        console.log('[listFieldDefinitions] ✓ Selected list ID:', selectedListId)
                    } catch (e) {
                        // Not JSON, use as is
                        selectedListId = selectedListStr
                        console.log('[listFieldDefinitions] ✓ Selected list (plain):', selectedListId)
                    }
                }

                if (selectedListId) {
                    // Check cache for this specific list
                    const cached = fieldDefinitionsCache.get(selectedListId)
                    if (cached && cached.length > 0) {
                        console.log('[listFieldDefinitions] Using cached fields for selected list:', cached.length)
                        cached.forEach((field: any) => {
                            // Store field metadata in name as JSON for later use
                            const fieldData = {
                                fieldId: field._id,
                                fieldName: field.name,
                                fieldType: field.type,
                                order: field.order
                            }

                            returnData.push({
                                label: `${field.name} (${field.type})`,
                                name: JSON.stringify(fieldData),
                                description: `Type: ${field.type} | Order: ${field.order}`
                            })
                        })
                        return returnData
                    }
                }

                // If no selectedList or not in cache, return ALL cached fields from all lists
                // This handles the case when asyncOptions is inside an array and can't access parent inputs
                console.log('[listFieldDefinitions] No specific list or not cached, returning all cached fields')
                console.log('[listFieldDefinitions] Cache has', fieldDefinitionsCache.size, 'lists')

                const fieldsMap = new Map<string, any>() // Use map to avoid duplicates

                // Collect all fields from all cached lists
                for (const [listId, fields] of fieldDefinitionsCache.entries()) {
                    console.log('[listFieldDefinitions] Adding', fields.length, 'fields from list', listId)
                    for (const field of fields) {
                        // Use field._id as key to avoid duplicates
                        if (!fieldsMap.has(field._id)) {
                            fieldsMap.set(field._id, field)
                        }
                    }
                }

                // Convert to array and sort
                const allFields = Array.from(fieldsMap.values())
                allFields.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))

                for (const field of allFields) {
                    const fieldData = {
                        fieldId: field._id,
                        fieldName: field.name,
                        fieldType: field.type,
                        order: field.order
                    }

                    returnData.push({
                        label: `${field.name} (${field.type})`,
                        name: JSON.stringify(fieldData),
                        description: `Type: ${field.type} | Order: ${field.order || 'N/A'}`
                    })
                }

                console.log('[listFieldDefinitions] Returning', returnData.length, 'field options from all cached lists')
                return returnData
            } catch (error: any) {
                console.error('[listFieldDefinitions] Error:', error.message)
                return []
            }
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedItemStr = nodeData.inputs?.selectedItem as string
        const itemName = nodeData.inputs?.itemName as string
        const itemDescription = nodeData.inputs?.itemDescription as string
        const moveToStage = nodeData.inputs?.moveToStage as string

        try {
            if (!selectedItemStr) {
                throw new Error('Please select an item to update')
            }

            // Parse selected item to get full item data
            let currentItem: any
            try {
                currentItem = JSON.parse(selectedItemStr)
            } catch (e) {
                // If not JSON, treat as item ID
                currentItem = { _id: selectedItemStr }
            }

            const itemId = currentItem._id

            console.log('Current item data:', JSON.stringify(currentItem, null, 2))

            // Display formatted info if available
            if (currentItem.__formattedInfo) {
                console.log('\n' + '='.repeat(60))
                console.log('CURRENT ITEM INFORMATION')
                console.log('='.repeat(60))
                console.log(currentItem.__formattedInfo)
                console.log('='.repeat(60) + '\n')
            }

            const credentialId = nodeData.credential || ''
            if (!credentialId) {
                throw new Error('Credential is required')
            }

            const credentialData = await getCredentialData(credentialId, options)
            const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
            const userId = credentialData.userId
            const authToken = credentialData.authToken

            // Extract current file URLs from customFields for read-only display
            let currentMarketingFileUrl = ''
            let currentRecruitmentCVUrl = ''

            if (currentItem.customFields && Array.isArray(currentItem.customFields)) {
                // Find Marketing File
                const marketingFileField = currentItem.customFields.find((cf: any) => cf.fieldId === PRIVOS_FIELD_IDS.MARKETING.FILE)
                if (marketingFileField && marketingFileField.value && marketingFileField.value.url) {
                    const file = marketingFileField.value
                    currentMarketingFileUrl = file.url.startsWith('http') ? file.url : `${baseUrl.replace('/api/v1', '')}${file.url}`
                }

                // Find Recruitment CV
                const recruitmentCVField = currentItem.customFields.find((cf: any) => cf.fieldId === PRIVOS_FIELD_IDS.RECRUITMENT.CV)
                if (recruitmentCVField && recruitmentCVField.value && recruitmentCVField.value.url) {
                    const file = recruitmentCVField.value
                    currentRecruitmentCVUrl = file.url.startsWith('http') ? file.url : `${baseUrl.replace('/api/v1', '')}${file.url}`
                }
            }

            // Build update payload
            const payload: any = {
                itemId: itemId
            }

            // Update name if provided
            if (itemName) {
                payload.name = itemName
            }

            // Update description if provided
            if (itemDescription) {
                payload.description = itemDescription
            }

            // Get list field definitions to validate which fields exist
            const currentListId = currentItem.listId
            let listFieldIds: string[] = []

            if (currentListId) {
                try {
                    const listApiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LIST_DETAIL}/${currentListId}`
                    const listResponse = await secureAxiosRequest({
                        method: 'GET',
                        url: listApiUrl,
                        headers: {
                            [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                            [PRIVOS_HEADERS.USER_ID]: userId,
                            [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                        }
                    })
                    const fieldDefinitions = listResponse.data?.list?.fieldDefinitions || []
                    listFieldIds = fieldDefinitions.map((f: any) => f._id)
                    console.log('[UPDATE ITEM] List field IDs:', listFieldIds)
                } catch (err) {
                    console.error('[UPDATE ITEM] Error fetching list fields:', err)
                }
            }

            // Map input field names to Privos field IDs based on selected list
            // Using centralized constants from PRIVOS_FIELD_IDS
            const fieldMapping: { [key: string]: string } = {
                // Marketing Campaign Template fields
                field_marketing_assignees: PRIVOS_FIELD_IDS.MARKETING.ASSIGNEES,
                field_marketing_due_date: PRIVOS_FIELD_IDS.MARKETING.DUE_DATE,
                field_marketing_start_date: PRIVOS_FIELD_IDS.MARKETING.START_DATE,
                field_marketing_end_date: PRIVOS_FIELD_IDS.MARKETING.END_DATE,
                field_marketing_file: PRIVOS_FIELD_IDS.MARKETING.FILE,
                field_marketing_documents: PRIVOS_FIELD_IDS.MARKETING.DOCUMENTS,
                field_marketing_note: PRIVOS_FIELD_IDS.MARKETING.NOTE,
                // HR/Recruitment Template fields
                field_recruitment_cv: PRIVOS_FIELD_IDS.RECRUITMENT.CV,
                field_recruitment_ai_summary: PRIVOS_FIELD_IDS.RECRUITMENT.AI_SUMMARY,
                field_recruitment_ai_score: PRIVOS_FIELD_IDS.RECRUITMENT.AI_SCORE,
                field_recruitment_interview_time: PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_TIME,
                field_recruitment_interviewer: PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEWER,
                field_recruitment_interview_questions: PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_QUESTIONS,
                field_recruitment_interview_notes: PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_NOTES,
                field_recruitment_interview_score: PRIVOS_FIELD_IDS.RECRUITMENT.INTERVIEW_SCORE,
                field_recruitment_trial_time: PRIVOS_FIELD_IDS.RECRUITMENT.TRIAL_TIME,
                field_recruitment_cv_content: PRIVOS_FIELD_IDS.RECRUITMENT.CV_CONTENT
            }

            // Process individual custom fields
            const allCustomFields: any[] = []

            console.log('[UPDATE ITEM] Processing custom fields for list:', currentListId)

            for (const [inputName, fieldId] of Object.entries(fieldMapping)) {
                const fieldValue = nodeData.inputs?.[inputName]

                // Only process fields that have values (user wants to update)
                // Empty fields mean "keep current value"
                if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                    console.log(`[UPDATE ITEM] Found field ${inputName}:`, fieldValue)

                    // Validate field exists in list (only update fields that exist)
                    if (listFieldIds.length > 0 && !listFieldIds.includes(fieldId)) {
                        console.warn(`[UPDATE ITEM] Field ${fieldId} not in list, skipping`)
                        continue
                    }

                    // Handle different field types
                    let processedValue = fieldValue

                    // For FILE fields - upload file first and get file object
                    if (typeof fieldValue === 'string' && (inputName === 'field_marketing_file' || inputName === 'field_recruitment_cv')) {
                        try {
                            let fileBuffer: Buffer
                            let fileName: string
                            let mimeType: string

                            // Check if it's a base64 data URI (e.g., "data:application/pdf;base64,JVBERi0x...")
                            if (fieldValue.startsWith('data:')) {
                                console.log(`[UPDATE ITEM] Processing base64 data URI for ${inputName}`)

                                // Extract filename if present (format: "data:mime;base64,data,filename:name.ext")
                                const filenameMatch = fieldValue.match(/,filename:([^,]+)$/)
                                const originalFilename = filenameMatch ? filenameMatch[1] : null

                                // Parse data URI: data:mime/type;base64,<data>
                                // Remove filename suffix if present
                                const dataUriPart = filenameMatch ? fieldValue.substring(0, filenameMatch.index) : fieldValue
                                const matches = dataUriPart.match(/^data:([^;]+);base64,(.+)$/)
                                if (!matches) {
                                    throw new Error('Invalid data URI format')
                                }

                                const browserMimeType = matches[1]
                                const base64Data = matches[2]

                                // Convert base64 to buffer
                                fileBuffer = Buffer.from(base64Data, 'base64')

                                // Determine correct MIME type from filename extension if available
                                if (originalFilename) {
                                    const detectedMimeType = getMimeTypeFromFilename(originalFilename)

                                    // If browser set octet-stream but we can detect from extension, use detected
                                    if (
                                        browserMimeType === 'application/octet-stream' &&
                                        detectedMimeType &&
                                        detectedMimeType !== 'application/octet-stream'
                                    ) {
                                        mimeType = detectedMimeType
                                        console.log(`[UPDATE ITEM] Browser MIME type was octet-stream, detected ${mimeType} from extension`)
                                    } else {
                                        mimeType = browserMimeType
                                    }

                                    fileName = originalFilename
                                } else {
                                    // No filename, generate from mime type
                                    mimeType = browserMimeType
                                    const ext = mimeType.split('/')[1] || 'bin'
                                    fileName = `file_${Date.now()}.${ext}`
                                }

                                console.log(`[UPDATE ITEM] Parsed base64 file: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`)
                            }
                            // Check if it's stored-file JSON format
                            else {
                                const parsed = JSON.parse(fieldValue)
                                const uploads: IFileUpload[] = Array.isArray(parsed) ? parsed : [parsed]

                                if (uploads.length === 0 || uploads[0].type !== 'stored-file') {
                                    console.warn(`[UPDATE ITEM] Skipping file field ${inputName}: not a stored-file`)
                                    continue
                                }

                                const upload = uploads[0]
                                console.log(`[UPDATE ITEM] Processing stored file for ${inputName}:`, upload.name)

                                // Get file buffer from storage
                                fileBuffer = await getFileFromStorage(upload.name, options.orgId, options.chatflowid, options.chatId)

                                fileName = upload.name
                                mimeType = upload.mime
                            }

                            // Upload file to Privos
                            const fileObject = await uploadFileToPrivos(fileBuffer, fileName, mimeType, baseUrl, userId, authToken)

                            console.log(`[UPDATE ITEM] File uploaded successfully:`, fileObject)
                            processedValue = fileObject
                        } catch (e) {
                            console.error(`[UPDATE ITEM] Failed to upload file for ${inputName}:`, e)
                            throw new Error(`Failed to upload file: ${e.message}`)
                        }
                    }
                    // For asyncOptions (USER fields), keep the full object with _id and username
                    else if (typeof fieldValue === 'string' && (fieldValue.startsWith('[{') || fieldValue.startsWith('{'))) {
                        try {
                            const parsed = JSON.parse(fieldValue)
                            if (Array.isArray(parsed)) {
                                // Multiple users - keep objects with _id and username
                                processedValue = parsed.map((u: any) => ({
                                    _id: u._id,
                                    username: u.username
                                }))
                            } else if (parsed._id) {
                                // Single user - wrap in array with _id and username
                                processedValue = [{ _id: parsed._id, username: parsed.username }]
                            }
                            console.log(`[UPDATE ITEM] Parsed USER field ${inputName}:`, processedValue)
                        } catch (e) {
                            console.warn(`[UPDATE ITEM] Failed to parse ${inputName}, using as-is`)
                        }
                    }

                    allCustomFields.push({
                        fieldId: fieldId,
                        value: processedValue
                    })

                    console.log(`[UPDATE ITEM] ✓ Will update field: ${fieldId} = ${JSON.stringify(processedValue).substring(0, 100)}`)
                }
            }

            console.log('[UPDATE ITEM] Total custom fields to update:', allCustomFields.length)

            // Add customFields to payload if any
            if (allCustomFields.length > 0) {
                payload.customFields = allCustomFields
            }

            console.log('Update Item Payload:', JSON.stringify(payload, null, 2))

            // Get list details for better output formatting
            const listId = currentItem.listId
            let listData: any = {}
            let fieldDefinitions: any[] = []

            if (listId) {
                try {
                    const listApiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LIST_DETAIL}/${listId}`
                    const listResponse = await secureAxiosRequest({
                        method: 'GET',
                        url: listApiUrl,
                        headers: {
                            [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                            [PRIVOS_HEADERS.USER_ID]: userId,
                            [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                        }
                    })
                    listData = listResponse.data?.list || listResponse.data
                    fieldDefinitions = listData.fieldDefinitions || []
                } catch (err) {
                    console.error('Error fetching list details:', err)
                }
            }

            // Send update request
            const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_UPDATE}`
            const response = await secureAxiosRequest({
                method: 'PUT',
                url: apiUrl,
                headers: {
                    [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                    [PRIVOS_HEADERS.USER_ID]: userId,
                    [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                },
                data: payload
            })

            console.log('Update Item Response:', JSON.stringify(response.data, null, 2))

            const updatedItem = response.data?.item || response.data

            // === MOVE TO STAGE (if specified) ===
            let movedToStage = false
            let newStageName = ''

            if (moveToStage) {
                try {
                    console.log('[UPDATE ITEM] Moving item to new stage:', moveToStage)

                    const moveApiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_MOVE}`
                    const moveResponse = await secureAxiosRequest({
                        method: 'POST',
                        url: moveApiUrl,
                        headers: {
                            [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                            [PRIVOS_HEADERS.USER_ID]: userId,
                            [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                        },
                        data: {
                            itemId: itemId,
                            stageId: moveToStage
                        }
                    })

                    console.log('[UPDATE ITEM] Move stage response:', JSON.stringify(moveResponse.data, null, 2))
                    movedToStage = true

                    // Get stage name for display
                    try {
                        const stagesApiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.STAGES_BY_LIST_ID}`
                        const stagesResponse = await secureAxiosRequest({
                            method: 'GET',
                            url: stagesApiUrl,
                            headers: {
                                [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                                [PRIVOS_HEADERS.USER_ID]: userId,
                                [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                            },
                            params: { listId: listId }
                        })

                        const stages = stagesResponse.data?.stages || []
                        const newStage = stages.find((s: any) => s._id === moveToStage)
                        newStageName = newStage?.name || moveToStage
                    } catch (e) {
                        newStageName = moveToStage
                    }
                } catch (moveError: any) {
                    console.error('[UPDATE ITEM] Error moving stage:', moveError.message)
                    // Don't fail the whole operation, just log the error
                }
            }

            // Format custom fields summary
            const customFieldsSummary =
                allCustomFields && allCustomFields.length > 0
                    ? allCustomFields
                          .map((cf: any) => {
                              const fieldDef = fieldDefinitions.find((f: any) => f._id === cf.fieldId)
                              const fieldName = fieldDef?.name || cf.fieldId

                              // Format value based on type
                              let displayValue: string

                              // Special formatting for FILE fields
                              if (cf.value && typeof cf.value === 'object' && cf.value.url && cf.value._id) {
                                  // This is a file object - format with full URL
                                  const fileUrl = cf.value.url.startsWith('http')
                                      ? cf.value.url
                                      : `${baseUrl.replace('/api/v1', '')}${cf.value.url}`

                                  return `   ${fieldName}:
      📎 File: ${cf.value.name}
      🔗 URL: ${fileUrl}
      📊 Size: ${(cf.value.size / 1024).toFixed(2)} KB
      📄 Type: ${cf.value.type}`
                              }
                              // Array formatting
                              else if (Array.isArray(cf.value)) {
                                  if (cf.value.length > 0 && cf.value[0]._id && cf.value[0].username) {
                                      // User array
                                      displayValue = cf.value.map((u: any) => `@${u.username}`).join(', ')
                                  } else {
                                      displayValue = JSON.stringify(cf.value)
                                  }
                              }
                              // Object formatting
                              else if (typeof cf.value === 'object') {
                                  displayValue = JSON.stringify(cf.value)
                              }
                              // Date formatting
                              else if (typeof cf.value === 'string' && cf.value.includes('T') && cf.value.includes('Z')) {
                                  displayValue = new Date(cf.value).toLocaleString('en-GB')
                              }
                              // Default
                              else {
                                  displayValue = cf.value
                              }

                              return `   ${fieldName}: ${displayValue}`
                          })
                          .join('\n')
                    : '   No fields updated'

            const outputContent = `ITEM UPDATED SUCCESSFULLY
${'='.repeat(50)}

ITEM ID: ${itemId}
ITEM NAME: ${payload.name || currentItem.name}

LIST: ${listData.name || listId || 'Unknown'}
${movedToStage ? `MOVED TO STAGE: ${newStageName}\n` : ''}${payload.description ? `\nDESCRIPTION:\n${payload.description}\n` : ''}
${'='.repeat(50)}
UPDATED FIELDS:
${'='.repeat(50)}

${customFieldsSummary}

${'='.repeat(50)}

The item has been updated successfully.${movedToStage ? ' Item moved to new stage.' : ''}`

            const outputData = {
                success: true,
                itemId: itemId,
                itemName: payload.name || currentItem.name,
                listId: listId,
                listName: listData.name || '',
                updatedFieldsCount: allCustomFields.length,
                updatedItem: updatedItem,
                // Populate read-only file URL fields for UI display
                current_marketing_file_url: currentMarketingFileUrl,
                current_recruitment_cv_url: currentRecruitmentCVUrl,
                ...(movedToStage && {
                    movedToStage: true,
                    newStageId: moveToStage,
                    newStageName: newStageName
                })
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: payload,
                output: {
                    content: outputContent,
                    ...outputData
                },
                state: options.agentflowRuntime?.state || {}
            }
        } catch (error: any) {
            console.error('Update Item Error:', error)

            const errorMessage = error.message || 'Unknown error'
            const errorDetails = error.response?.data || null

            const errorContent = `FAILED TO UPDATE ITEM
${'='.repeat(50)}

ERROR: ${errorMessage}

${errorDetails ? `DETAILS: ${JSON.stringify(errorDetails, null, 2)}\n\n` : ''}${'='.repeat(50)}`

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    itemId: nodeData.inputs?.selectedItem,
                    error: 'Failed to process update'
                },
                output: {
                    content: errorContent,
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                    statusCode: error.response?.status || 500
                },
                state: options.agentflowRuntime?.state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosItemUpdate_Agentflow }
