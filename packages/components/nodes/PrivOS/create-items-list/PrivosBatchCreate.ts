import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue, IFileUpload } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'
import { getFileFromStorage } from '../../../src/storageUtils'
import {
    CACHE_TTL,
    PRIVOS_ENDPOINTS,
    PRIVOS_HEADERS,
    CONTENT_TYPES,
    DEFAULT_PRIVOS_API_BASE_URL,
    ERROR_MESSAGES,
    REQUEST_CONFIG,
    ROOM_TYPES,
    PRIVOS_FIELD_IDS
} from '../constants'
import { uploadFileToPrivos, getMimeTypeFromFilename } from '../utils'

// Global cache for rooms and fields
const roomsCachePostItem: Map<string, { rooms: any[]; timestamp: number }> = new Map()
const fieldDefinitionsCache: Map<string, any[]> = new Map() // Cache field definitions by list ID

async function fetchRoomsFromAPIPostItem(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
    try {
        const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ROOMS_GET}`
        console.log('Fetching rooms from:', apiUrl)

        const response = await secureAxiosRequest({
            method: 'GET',
            url: apiUrl,
            headers: {
                [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                [PRIVOS_HEADERS.USER_ID]: userId,
                [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
            }
        })

        const rooms = response.data?.update || []
        console.log('Fetched', rooms.length, 'rooms')
        return rooms
    } catch (error: any) {
        console.error('Error fetching rooms:', error.message)
        throw error
    }
}

class PrivosBatchCreate_Agentflow implements INode {
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
        this.label = 'Create Item in List'
        this.name = 'privosBatchCreate'
        this.version = 20.0
        this.type = 'PrivosBatchCreate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#4CAF50'
        this.description = 'Create one or multiple items in a list stage with custom fields'
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
                description: 'Select a list to view its stages and fields'
            },
            {
                label: 'Select Stage',
                name: 'selectedStage',
                type: 'asyncOptions',
                loadMethod: 'listStages',
                refresh: true,
                description: 'Select a stage to create item in',
                optional: true
            },
            {
                label: 'Item Name',
                name: 'itemName',
                type: 'string',
                placeholder: 'Enter item name or {{$flow.itemName}}',
                acceptVariable: true,
                description: 'Name of the item to create'
            },
            {
                label: 'Item Description',
                name: 'itemDescription',
                type: 'string',
                rows: 4,
                placeholder: 'Enter description or {{$flow.description}}',
                acceptVariable: true,
                optional: true,
                description: 'Description of the item'
            },
            // === MARKETING LIST FIELDS (7 fields) ===
            {
                label: '1. Assignees',
                name: 'field_marketing_assignees',
                type: 'asyncOptions',
                loadMethod: 'listUsers',
                list: true,
                optional: true,
                description: 'Select users to assign this marketing task to',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '2. Due Date',
                name: 'field_marketing_due_date',
                type: 'date',
                optional: true,
                description: 'Due date for this marketing task',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '3. Start Date',
                name: 'field_marketing_start_date',
                type: 'date',
                optional: true,
                description: 'Start date for this marketing campaign',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '4. End Date',
                name: 'field_marketing_end_date',
                type: 'date',
                optional: true,
                description: 'End date for this marketing campaign',
                show: {
                    selectedList: 'marketing'
                }
            },
            {
                label: '5. File',
                name: 'field_marketing_file',
                type: 'file',
                optional: true,
                description: 'Upload a file for this marketing task',
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
                description: 'Documents with title and content - fieldId: marketing_campaign_documents_field',
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
                placeholder: 'Enter notes for this marketing task',
                description: 'Additional notes for this marketing task',
                show: {
                    selectedList: 'marketing'
                }
            },
            // === HR/RECRUITMENT LIST FIELDS (10 fields) ===
            {
                label: '1. CV',
                name: 'field_recruitment_cv',
                type: 'file',
                optional: true,
                description: 'Upload candidate CV',
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
                placeholder: 'AI-generated summary of the CV',
                description: 'AI-generated summary of the candidate',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '3. AI Score',
                name: 'field_recruitment_ai_score',
                type: 'number',
                optional: true,
                placeholder: 'Enter AI score (0-100)',
                description: 'AI-generated score for the candidate',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '4. Interview Time',
                name: 'field_recruitment_interview_time',
                type: 'date',
                optional: true,
                description: 'Schedule interview date and time',
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
                description: 'Select interviewer(s)',
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
                placeholder: 'Enter interview questions',
                description: 'Questions to ask during the interview',
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
                placeholder: 'Enter interview notes',
                description: 'Notes from the interview',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '8. Interview Score',
                name: 'field_recruitment_interview_score',
                type: 'number',
                optional: true,
                placeholder: 'Enter interview score (0-100)',
                description: 'Score from the interview',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            },
            {
                label: '9. Trial Time',
                name: 'field_recruitment_trial_time',
                type: 'date',
                optional: true,
                description: 'Trial period date',
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
                placeholder: 'Enter CV content text',
                description: 'Text content extracted from CV',
                show: {
                    selectedList: 'personnel-recruitment'
                }
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listRooms(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listRooms] START')

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('No credential ID found!')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData || Object.keys(credentialData).length === 0) {
                    console.error('No credential data returned!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error(ERROR_MESSAGES.MISSING_USER_ID)
                    return returnData
                }

                // Cache rooms
                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()
                const cached = roomsCachePostItem.get(cacheKey)

                let rooms: any[]
                if (cached && now - cached.timestamp < CACHE_TTL) {
                    console.log('Using cached rooms')
                    rooms = cached.rooms
                } else {
                    console.log('Fetching fresh rooms from API')
                    rooms = await fetchRoomsFromAPIPostItem(baseUrl, userId, authToken)
                    roomsCachePostItem.set(cacheKey, { rooms, timestamp: now })
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

                console.log('Returning', returnData.length, 'rooms')
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
                if (!selectedRoom) {
                    console.log('No room selected yet')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('No credential ID found!')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) {
                    console.error('No credential data found!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error(ERROR_MESSAGES.MISSING_USER_ID)
                    return returnData
                }

                const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LISTS_BY_ROOM_ID}`
                console.log('Fetching lists from:', apiUrl)

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
                console.log('Lists found:', lists.length)

                // Process each list and cache field definitions (already in response!)
                for (const list of lists) {
                    const stageCount = list.stageCount || 0
                    const itemCount = list.itemCount || 0

                    // Store listId and templateKey in the value
                    // templateKey is more stable than name (e.g., "marketing", "personnel-recruitment")
                    returnData.push({
                        label: list.name,
                        name: JSON.stringify({
                            listId: list._id,
                            listName: list.name,
                            templateKey: list.templateKey || ''
                        }),
                        description: `${stageCount} stages, ${itemCount} items`
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

                console.log('Returning', returnData.length, 'list options')
                return returnData
            } catch (error: any) {
                console.error('[listLists] Error:', error.message)
                return returnData
            }
        },

        async listStages(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listStages] START')

                const selectedListStr = nodeData.inputs?.selectedList as string
                if (!selectedListStr) {
                    console.log('No list selected yet')
                    return returnData
                }

                // Parse list data from JSON
                let selectedList: string
                try {
                    const parsed = JSON.parse(selectedListStr)
                    selectedList = parsed.listId
                } catch (e) {
                    // Fallback for old format
                    selectedList = selectedListStr
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('No credential ID found!')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) {
                    console.error('No credential data found!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error(ERROR_MESSAGES.MISSING_USER_ID)
                    return returnData
                }

                // Get list details to fetch stages
                const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.LIST_DETAIL}/${selectedList}`
                console.log('Fetching list details from:', apiUrl)

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
                console.log('Stages found:', stages.length)

                // Cache field definitions for later use in listCustomFields
                const listData = response.data?.list || response.data
                if (listData.fieldDefinitions && listData.fieldDefinitions.length > 0) {
                    fieldDefinitionsCache.set(selectedList, listData.fieldDefinitions)
                    console.log('[listStages] Cached', listData.fieldDefinitions.length, 'field definitions for list', selectedList)
                }

                // Sort stages by order
                stages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))

                for (const stage of stages) {
                    returnData.push({
                        label: stage.name,
                        name: stage._id,
                        description: `Order: ${stage.order}, Color: ${stage.color || 'default'}`
                    })
                }

                console.log('Returning', returnData.length, 'stage options')
                return returnData
            } catch (error: any) {
                console.error('[listStages] Error:', error.message)
                return returnData
            }
        },

        async listUsers(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listUsers] START')

                const selectedRoom = nodeData.inputs?.selectedRoom as string
                if (!selectedRoom) {
                    console.log('No room selected yet')
                    return returnData
                }

                const credentialId = nodeData.credential || ''
                if (!credentialId) {
                    console.error('No credential ID found!')
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData) {
                    console.error('No credential data found!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error(ERROR_MESSAGES.MISSING_USER_ID)
                    return returnData
                }

                // First, get room details to determine room type
                const cacheKey = `${userId}_${authToken}`
                const cached = roomsCachePostItem.get(cacheKey)
                let rooms: any[] = []

                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    rooms = cached.rooms
                } else {
                    rooms = await fetchRoomsFromAPIPostItem(baseUrl, userId, authToken)
                    roomsCachePostItem.set(cacheKey, { rooms, timestamp: Date.now() })
                }

                const room = rooms.find((r: any) => r._id === selectedRoom)
                const roomType = room?.t || 'c' // Default to channel if not found

                console.log('[listUsers] Room type:', roomType, 'for room:', selectedRoom)

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

                console.log('[listUsers] Fetching room members from:', apiEndpoint)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiEndpoint,
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

                const members = response.data?.members || []
                console.log('[listUsers] Members found:', members.length)

                for (const member of members) {
                    returnData.push({
                        label: member.name || member.username || member._id,
                        name: JSON.stringify({
                            _id: member._id,
                            username: member.username || member.name
                        }),
                        description: member.username ? `@${member.username}` : ''
                    })
                }

                console.log('[listUsers] Returning', returnData.length, 'user options')
                return returnData
            } catch (error: any) {
                console.error('[listUsers] Error:', error.message)
                console.error('[listUsers] Error details:', error.response?.data || 'No response data')
                return returnData
            }
        },

        async listFieldDefinitions(nodeData: INodeData): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listFieldDefinitions] ========== START ==========')
                console.log('[listFieldDefinitions] nodeData.inputs:', JSON.stringify(nodeData.inputs, null, 2))

                // Try to get selectedList from nodeData.inputs
                const selectedListStr = nodeData.inputs?.selectedList as string

                if (selectedListStr) {
                    console.log('[listFieldDefinitions] ✓ Selected list string:', selectedListStr)

                    // Parse list data from JSON
                    let selectedList: string
                    try {
                        const parsed = JSON.parse(selectedListStr)
                        selectedList = parsed.listId
                    } catch (e) {
                        // Fallback for old format
                        selectedList = selectedListStr
                    }

                    // Check cache for this specific list
                    const cached = fieldDefinitionsCache.get(selectedList)
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
        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            // Get credentials
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const baseUrl = getCredentialParam('baseUrl', credentialData, nodeData) || DEFAULT_PRIVOS_API_BASE_URL
            const userId = getCredentialParam('userId', credentialData, nodeData)
            const authToken = getCredentialParam('authToken', credentialData, nodeData)

            if (!userId || !authToken) {
                throw new Error(ERROR_MESSAGES.MISSING_CREDENTIALS)
            }

            // Build from form inputs
            const selectedListStr = nodeData.inputs?.selectedList as string
            const selectedStage = nodeData.inputs?.selectedStage as string
            const itemName = nodeData.inputs?.itemName as string
            const itemDescription = nodeData.inputs?.itemDescription as string

            // Form validation
            if (!selectedListStr) {
                throw new Error(ERROR_MESSAGES.MISSING_LIST_SELECTION)
            }

            if (!selectedStage) {
                throw new Error(ERROR_MESSAGES.MISSING_STAGE_SELECTION)
            }

            if (!itemName || itemName.trim() === '') {
                throw new Error(ERROR_MESSAGES.MISSING_ITEM_NAME)
            }

            // Parse list data from JSON
            let listIdToUse: string
            try {
                const parsed = JSON.parse(selectedListStr)
                listIdToUse = parsed.listId
            } catch (e) {
                // Fallback for old format
                listIdToUse = selectedListStr
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

            console.log('[CREATE ITEM] Processing custom fields for list:', listIdToUse)

            for (const [inputName, fieldId] of Object.entries(fieldMapping)) {
                const fieldValue = nodeData.inputs?.[inputName]

                if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                    console.log(`[CREATE ITEM] Found field ${inputName}:`, fieldValue)

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
                                console.log(`[CREATE ITEM] Processing base64 data URI for ${inputName}`)

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
                                        console.log(`[CREATE ITEM] Browser MIME type was octet-stream, detected ${mimeType} from extension`)
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

                                console.log(`[CREATE ITEM] Parsed base64 file: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`)
                            }
                            // Check if it's stored-file JSON format
                            else {
                                const parsed = JSON.parse(fieldValue)
                                const uploads: IFileUpload[] = Array.isArray(parsed) ? parsed : [parsed]

                                if (uploads.length === 0 || uploads[0].type !== 'stored-file') {
                                    console.warn(`[CREATE ITEM] Skipping file field ${inputName}: not a stored-file`)
                                    continue
                                }

                                const upload = uploads[0]
                                console.log(`[CREATE ITEM] Processing stored file for ${inputName}:`, upload.name)

                                // Get file buffer from storage
                                fileBuffer = await getFileFromStorage(upload.name, options.orgId, options.chatflowid, options.chatId)

                                fileName = upload.name
                                mimeType = upload.mime
                            }

                            // Upload file to Privos
                            const fileObject = await uploadFileToPrivos(fileBuffer, fileName, mimeType, baseUrl, userId, authToken)

                            console.log(`[CREATE ITEM] File uploaded successfully:`, fileObject)
                            processedValue = fileObject
                        } catch (e) {
                            console.error(`[CREATE ITEM] Failed to upload file for ${inputName}:`, e)
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
                            console.log(`[CREATE ITEM] Parsed USER field ${inputName}:`, processedValue)
                        } catch (e) {
                            console.warn(`[CREATE ITEM] Failed to parse ${inputName}, using as-is`)
                        }
                    }

                    allCustomFields.push({
                        fieldId: fieldId,
                        value: processedValue
                    })

                    console.log(`[CREATE ITEM] ✓ Added field: ${fieldId} = ${JSON.stringify(processedValue).substring(0, 100)}`)
                }
            }

            console.log('[CREATE ITEM] Total custom fields to send:', allCustomFields.length)

            // Create single item object
            const itemToCreate: any = {
                name: itemName,
                stageId: selectedStage
            }

            if (itemDescription && itemDescription.trim() !== '') {
                itemToCreate.description = itemDescription
            }

            if (allCustomFields && allCustomFields.length > 0) {
                itemToCreate.customFields = allCustomFields
            }

            const requestBody = {
                listId: listIdToUse,
                items: [itemToCreate]
            }

            // Note: fieldDefinitions and listData already fetched above for dynamic field mapping
            // No need to fetch again

            // Call batch-create API
            const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_BATCH_CREATE}`
            console.log('Creating', requestBody.items.length, 'item(s) via batch-create API')
            console.log('Request body:', JSON.stringify(requestBody, null, 2))

            const response = await secureAxiosRequest({
                method: 'POST',
                url: apiUrl,
                headers: {
                    [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                    [PRIVOS_HEADERS.USER_ID]: userId,
                    [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
                },
                data: requestBody
            })

            console.log('Items created successfully')

            const createdItems = response.data?.items || []

            // Form mode - single item output
            const createdItem = createdItems[0]
            const originalItem = requestBody.items[0]

            // Format custom fields summary
            const customFieldsSummary =
                originalItem.customFields && originalItem.customFields.length > 0
                    ? originalItem.customFields
                          .map((cf: any) => {
                              return `   ${cf.fieldId}: ${JSON.stringify(cf.value)}`
                          })
                          .join('\n')
                    : '   No custom fields'

            const outputContent = `ITEM CREATED SUCCESSFULLY
${'='.repeat(50)}

ITEM ID: ${createdItem._id}
ITEM NAME: ${createdItem.name}

LIST ID: ${listIdToUse}
STAGE: ${createdItem.stageId || originalItem.stageId}

${originalItem.description ? `DESCRIPTION:\n${originalItem.description}\n\n` : ''}${'='.repeat(50)}
CUSTOM FIELDS:
${'='.repeat(50)}

${customFieldsSummary}

${'='.repeat(50)}

The item has been created and is now visible in the selected stage.`

            const outputData = {
                success: true,
                itemId: createdItem._id,
                itemName: createdItem.name,
                listId: listIdToUse,
                stageId: originalItem.stageId,
                customFieldsCount: originalItem.customFields ? originalItem.customFields.length : 0,
                createdItem: createdItem
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: requestBody,
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }
        } catch (error: any) {
            console.error('Error creating items:', error)

            const errorMessage = error.message || 'Unknown error'
            const errorDetails = error.response?.data || null

            const errorContent = `FAILED TO CREATE ITEMS
${'='.repeat(50)}

ERROR: ${errorMessage}

${errorDetails ? `DETAILS: ${JSON.stringify(errorDetails, null, 2)}\n\n` : ''}${'='.repeat(50)}`

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    error: 'Failed before processing input'
                },
                output: {
                    content: errorContent,
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                    statusCode: error.response?.status || 500
                },
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosBatchCreate_Agentflow }
