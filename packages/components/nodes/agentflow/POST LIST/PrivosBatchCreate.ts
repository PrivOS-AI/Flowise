import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData, getCredentialParam, parseJsonBody } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'
import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'

// Global cache for rooms and fields
const roomsCachePostItem: Map<string, { rooms: any[], timestamp: number }> = new Map()
const fieldDefinitionsCache: Map<string, any[]> = new Map() // Cache field definitions by list ID
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchRoomsFromAPIPostItem(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
    try {
        const apiUrl = `${baseUrl}/rooms.get`
        console.log('Fetching rooms from:', apiUrl)

        const response = await secureAxiosRequest({
            method: 'GET',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                'X-Auth-Token': authToken
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
            // === 7 HARDCODED FIELD DEFINITIONS (MUST ALWAYS SHOW) ===
            // These match exactly the Privos API fieldDefinitions structure
            {
                label: '1. Assignees (USER type)',
                name: 'field_assignees',
                type: 'asyncOptions',
                loadMethod: 'listUsers',
                list: true,
                optional: true,
                description: 'Select users from room - fieldId: marketing_campaign_assignees_field'
            },
            {
                label: '2. Due Date (DATE type)',
                name: 'field_due_date',
                type: 'date',
                optional: true,
                description: 'Select due date - fieldId: marketing_campaign_due_date_field'
            },
            {
                label: '3. Start Date (DATE type)',
                name: 'field_start_date',
                type: 'date',
                optional: true,
                description: 'Select start date - fieldId: marketing_campaign_start_date_field'
            },
            {
                label: '4. End Date (DATE type)',
                name: 'field_end_date',
                type: 'date',
                optional: true,
                description: 'Select end date - fieldId: marketing_campaign_end_date_field'
            },
            {
                label: '5. File (FILE type)',
                name: 'field_file',
                type: 'file',
                optional: true,
                description: 'Upload file - fieldId: marketing_campaign_file_link_field (v1/file.upload)'
            },
            {
                label: '6. Documents ',
                name: 'field_documents',
                type: 'array',
                acceptVariable: true,
                optional: true,
                description: 'Documents with title and content - fieldId: marketing_campaign_documents_field',
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
                label: '7. Note (TEXTAREA type)',
                name: 'field_note',
                type: 'string',
                rows: 4,
                placeholder: 'Enter your notes here...',
                acceptVariable: true,
                optional: true,
                description: 'Multi-line text - fieldId: marketing_campaign_note_field'
            },
            // === CUSTOM FIELDS SECTION (Dynamic) ===
            {
                label: 'Additional Custom Fields',
                name: 'customFields',
                type: 'array',
                acceptVariable: true,
                optional: true,
                description: 'Add custom fields beyond the 7 fixed fields above',
                array: [
                    {
                        label: 'Field Type',
                        name: 'fieldType',
                        type: 'options',
                        options: [
                            { label: 'Text', name: 'TEXT' },
                            { label: 'Text Area', name: 'TEXTAREA' },
                            { label: 'Number', name: 'NUMBER' },
                            { label: 'Date', name: 'DATE' },
                            { label: 'Date Time', name: 'DATE_TIME' },
                            { label: 'Select', name: 'SELECT' },
                            { label: 'Multi Select', name: 'MULTI_SELECT' },
                            { label: 'User', name: 'USER' },
                            { label: 'Checkbox', name: 'CHECKBOX' },
                            { label: 'URL', name: 'URL' },
                            { label: 'File', name: 'FILE' },
                            { label: 'Multiple Files', name: 'FILE_MULTIPLE' },
                            { label: 'Document', name: 'DOCUMENT' }
                        ],
                        default: 'TEXT'
                    },
                    {
                        label: 'Field Key/ID',
                        name: 'fieldKey',
                        type: 'string',
                        placeholder: 'custom_field_key',
                        acceptVariable: true
                    },
                    {
                        label: 'Field Value',
                        name: 'fieldValue',
                        type: 'string',
                        placeholder: 'Enter value based on field type',
                        acceptVariable: true,
                        rows: 2
                    }
                ]
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                // Cache rooms
                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()
                const cached = roomsCachePostItem.get(cacheKey)

                let rooms: any[]
                if (cached && (now - cached.timestamp < CACHE_TTL)) {
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                const apiUrl = `${baseUrl}/external.lists.byRoomId`
                console.log('Fetching lists from:', apiUrl)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
                    },
                    params: {
                        roomId: selectedRoom,
                        offset: 0,
                        count: 100
                    }
                })

                const lists = response.data?.lists || []
                console.log('Lists found:', lists.length)

                // Pre-fetch field definitions for each list to populate cache
                for (const list of lists) {
                    const stageCount = list.stageCount || 0
                    const itemCount = list.itemCount || 0

                    returnData.push({
                        label: list.name,
                        name: list._id,
                        description: `${stageCount} stages, ${itemCount} items`
                    })

                    // Fetch list details to cache field definitions
                    try {
                        const listDetailUrl = `${baseUrl}/external.lists/${list._id}`
                        const listDetailResponse = await secureAxiosRequest({
                            method: 'GET',
                            url: listDetailUrl,
                            headers: {
                                'Content-Type': 'application/json',
                                'X-User-Id': userId,
                                'X-Auth-Token': authToken
                            }
                        })

                        const listData = listDetailResponse.data?.list || listDetailResponse.data
                        if (listData.fieldDefinitions && listData.fieldDefinitions.length > 0) {
                            fieldDefinitionsCache.set(list._id, listData.fieldDefinitions)
                            console.log('[listLists] Cached', listData.fieldDefinitions.length, 'field definitions for list', list._id)
                        }
                    } catch (err) {
                        console.error('[listLists] Error caching fields for list', list._id, ':', err)
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

                const selectedList = nodeData.inputs?.selectedList as string
                if (!selectedList) {
                    console.log('No list selected yet')
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                // Get list details to fetch stages
                const apiUrl = `${baseUrl}/external.lists/${selectedList}`
                console.log('Fetching list details from:', apiUrl)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                // Get room members
                const apiUrl = `${baseUrl}/channels.members`
                console.log('Fetching room members from:', apiUrl)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
                    },
                    params: {
                        roomId: selectedRoom,
                        offset: 0,
                        count: 100
                    }
                })

                const members = response.data?.members || []
                console.log('Members found:', members.length)

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

                console.log('Returning', returnData.length, 'user options')
                return returnData

            } catch (error: any) {
                console.error('[listUsers] Error:', error.message)
                return returnData
            }
        },

        async listFieldDefinitions(nodeData: INodeData): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listFieldDefinitions] ========== START ==========')
                console.log('[listFieldDefinitions] nodeData.inputs:', JSON.stringify(nodeData.inputs, null, 2))

                // Try to get selectedList from nodeData.inputs
                const selectedList = nodeData.inputs?.selectedList as string

                if (selectedList) {
                    console.log('[listFieldDefinitions] ✓ Selected list:', selectedList)

                    // Check cache for this specific list
                    const cached = fieldDefinitionsCache.get(selectedList)
                    if (cached && cached.length > 0) {
                        console.log('[listFieldDefinitions] Using cached fields for selected list:', cached.length)
                        cached.forEach((field: any) => {
                            returnData.push({
                                label: `${field.name} (${field.type})`,
                                name: field._id,
                                description: `Type: ${field.type}`
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
                    returnData.push({
                        label: `${field.name} (${field.type})`,
                        name: field._id,
                        description: `Type: ${field.type}`
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
            const baseUrl = getCredentialParam('baseUrl', credentialData, nodeData) || 'https://privos-dev-web.roxane.one/api/v1'
            const userId = getCredentialParam('userId', credentialData, nodeData)
            const authToken = getCredentialParam('authToken', credentialData, nodeData)

            if (!userId || !authToken) {
                throw new Error('Missing credentials: User ID and Auth Token are required')
            }

            // Build from form inputs
            const selectedList = nodeData.inputs?.selectedList as string
            const selectedStage = nodeData.inputs?.selectedStage as string
            const itemName = nodeData.inputs?.itemName as string
            const itemDescription = nodeData.inputs?.itemDescription as string

            // Fixed field definitions from UI
            const field_assignees = nodeData.inputs?.field_assignees as string
            const field_due_date = nodeData.inputs?.field_due_date as string
            const field_start_date = nodeData.inputs?.field_start_date as string
            const field_end_date = nodeData.inputs?.field_end_date as string
            const field_file = nodeData.inputs?.field_file as any
            const field_documents = nodeData.inputs?.field_documents as any[]
            const field_note = nodeData.inputs?.field_note as string

            // Additional custom fields from array
            const customFieldsArray = nodeData.inputs?.customFields as any[]

            // Form validation
            if (!selectedList) {
                throw new Error('Please select a list')
            }

            if (!selectedStage) {
                throw new Error('Please select a stage')
            }

            if (!itemName || itemName.trim() === '') {
                throw new Error('Item name is required')
            }

            const listIdToUse = selectedList

            // Build customFields array from fixed fields and additional custom fields
            const allCustomFields: any[] = []

            // Map of fixed field names to their IDs (from fieldDefinitions)
            const fieldMapping: {[key: string]: string} = {
                'field_assignees': 'marketing_campaign_assignees_field',
                'field_due_date': 'marketing_campaign_due_date_field',
                'field_start_date': 'marketing_campaign_start_date_field',
                'field_end_date': 'marketing_campaign_end_date_field',
                'field_file': 'marketing_campaign_file_link_field',
                'field_documents': 'marketing_campaign_documents_field',
                'field_note': 'marketing_campaign_note_field'
            }

            // Process Assignees (USER type)
            if (field_assignees) {
                try {
                    let assigneesValue: any[] = []

                    if (typeof field_assignees === 'string') {
                        if (field_assignees.trim().startsWith('[')) {
                            assigneesValue = JSON.parse(field_assignees)
                        } else {
                            assigneesValue = [JSON.parse(field_assignees)]
                        }
                    } else if (Array.isArray(field_assignees)) {
                        assigneesValue = (field_assignees as any[]).map((user: any) => {
                            if (typeof user === 'string') {
                                return JSON.parse(user)
                            }
                            return user
                        })
                    } else {
                        assigneesValue = [field_assignees]
                    }

                    const validatedValue = assigneesValue.map((user: any) => ({
                        _id: user._id || user.id || user,
                        username: user.username || user.name || 'Unknown'
                    }))

                    allCustomFields.push({ fieldId: fieldMapping['field_assignees'], value: validatedValue })
                } catch (e) {
                    console.error('Failed to parse assignees:', e)
                    throw new Error('Invalid assignees format')
                }
            }

            // Process Date fields (DATE type) - Due Date, Start Date, End Date
            const processDateField = (fieldValue: string, fieldName: string) => {
                if (!fieldValue) return null

                try {
                    let isoDate: string
                    const dateInput = fieldValue

                    console.log(`Processing ${fieldName} - Raw input:`, dateInput)

                    if (typeof dateInput === 'string') {
                        // Check if already in ISO format
                        if (dateInput.includes('Z') && dateInput.includes('T') && dateInput.includes('.')) {
                            // Already in full ISO format
                            isoDate = dateInput
                        } else if (dateInput.includes('T')) {
                            // Has T separator but might be missing Z or milliseconds
                            if (dateInput.includes('Z')) {
                                // Has Z but might be missing milliseconds
                                if (!dateInput.includes('.')) {
                                    // Add milliseconds before Z
                                    isoDate = dateInput.replace('Z', '.000Z')
                                } else {
                                    isoDate = dateInput
                                }
                            } else {
                                // No Z, treat as local time and convert to UTC
                                const date = new Date(dateInput)
                                isoDate = date.toISOString()
                            }
                        } else {
                            // Just a date without time
                            isoDate = new Date(dateInput + 'T00:00:00.000Z').toISOString()
                        }
                    } else {
                        isoDate = new Date(dateInput).toISOString()
                    }

                    // Ensure format has milliseconds
                    if (!isoDate.includes('.')) {
                        isoDate = isoDate.replace('Z', '.000Z')
                    }

                    console.log(`${fieldName} - Converted output:`, isoDate)
                    return isoDate
                } catch (e) {
                    console.error(`Invalid date format for ${fieldName}:`, fieldValue, 'Error:', e)
                    throw new Error(`Invalid date format for ${fieldName}. Expected ISO format like: 2025-10-31T00:00:00.000Z`)
                }
            }

            if (field_due_date) {
                const isoDate = processDateField(field_due_date, 'Due Date')
                if (isoDate) {
                    allCustomFields.push({ fieldId: fieldMapping['field_due_date'], value: isoDate })
                }
            }

            if (field_start_date) {
                const isoDate = processDateField(field_start_date, 'Start Date')
                if (isoDate) {
                    allCustomFields.push({ fieldId: fieldMapping['field_start_date'], value: isoDate })
                }
            }

            if (field_end_date) {
                const isoDate = processDateField(field_end_date, 'End Date')
                if (isoDate) {
                    allCustomFields.push({ fieldId: fieldMapping['field_end_date'], value: isoDate })
                }
            }

            // Process File (FILE type)
            if (field_file) {
                let fileValue: any

                if (typeof field_file === 'string') {
                    try {
                        fileValue = JSON.parse(field_file)
                    } catch (e) {
                        try {
                            let fileData: Buffer
                            let fileName: string

                            if (field_file.startsWith('data:')) {
                                const matches = field_file.match(/^data:(.+);base64,(.+)$/)
                                if (matches) {
                                    const mimeType = matches[1]
                                    const base64Data = matches[2]
                                    fileData = Buffer.from(base64Data, 'base64')
                                    fileName = `file_${Date.now()}.${mimeType.split('/')[1]}`
                                } else {
                                    throw new Error('Invalid base64 format')
                                }
                            } else {
                                fileData = fs.readFileSync(field_file)
                                fileName = path.basename(field_file)
                            }

                            const formData = new FormData()
                            formData.append('file', fileData, fileName)

                            console.log('Uploading file to Privos:', fileName)

                            const uploadResponse = await secureAxiosRequest({
                                method: 'POST',
                                url: `${baseUrl}/files.upload`,
                                headers: {
                                    ...formData.getHeaders(),
                                    'X-User-Id': userId,
                                    'X-Auth-Token': authToken
                                },
                                data: formData
                            })

                            const uploadedFile = uploadResponse.data?.file

                            if (!uploadedFile || !uploadedFile._id || !uploadedFile.url) {
                                throw new Error('Upload response missing file data')
                            }

                            fileValue = {
                                _id: uploadedFile._id,
                                name: uploadedFile.name || fileName,
                                size: uploadedFile.size || fileData.length,
                                type: uploadedFile.type || 'application/octet-stream',
                                url: uploadedFile.url,
                                uploadedAt: uploadedFile.uploadedAt || new Date().toISOString()
                            }

                            console.log('File uploaded successfully:', fileValue)
                        } catch (uploadError: any) {
                            console.error('Error uploading file:', uploadError.message)
                            throw new Error(`Failed to upload file: ${uploadError.message}`)
                        }
                    }
                } else if (typeof field_file === 'object') {
                    fileValue = field_file
                }

                if (fileValue) {
                    allCustomFields.push({ fieldId: fieldMapping['field_file'], value: fileValue })
                }
            }

            // Process Documents (DOCUMENT type) - from array of documents
            if (field_documents && Array.isArray(field_documents) && field_documents.length > 0) {
                const documentValue = field_documents.map((doc: any) => ({
                    _id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    title: doc.title || 'Untitled',
                    content: doc.content || '',
                    versions: [{
                        version: 1,
                        content: doc.content || '',
                        createdAt: new Date().toISOString(),
                        createdBy: {
                            _id: userId,
                            username: 'system',
                            name: 'System'
                        }
                    }],
                    currentVersion: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }))

                allCustomFields.push({
                    fieldId: fieldMapping['field_documents'],
                    value: documentValue
                })
            }

            // Process Note (TEXTAREA type)
            if (field_note && field_note.trim()) {
                allCustomFields.push({ fieldId: fieldMapping['field_note'], value: field_note })
            }

            // Process additional custom fields from array
            if (customFieldsArray && Array.isArray(customFieldsArray)) {
                for (const field of customFieldsArray) {
                    if (field.fieldKey && field.fieldValue) {
                        // Handle different field types
                        let processedValue = field.fieldValue

                        // Process based on field type
                        if (field.fieldType === 'DATE' || field.fieldType === 'DATE_TIME') {
                            // Convert date to ISO format
                            processedValue = processDateField(field.fieldValue, `Custom field ${field.fieldKey}`)
                        } else if (field.fieldType === 'NUMBER') {
                            processedValue = Number(field.fieldValue)
                        } else if (field.fieldType === 'CHECKBOX') {
                            processedValue = field.fieldValue === 'true' || field.fieldValue === true
                        } else if (field.fieldType === 'USER') {
                            // Parse user if it's a string
                            if (typeof field.fieldValue === 'string' && field.fieldValue.includes('{')) {
                                try {
                                    processedValue = JSON.parse(field.fieldValue)
                                } catch (e) {
                                    // If parse fails, use as is
                                    processedValue = field.fieldValue
                                }
                            }
                        } else if (field.fieldType === 'MULTI_SELECT' || field.fieldType === 'FILE_MULTIPLE') {
                            // Parse array if it's a string
                            if (typeof field.fieldValue === 'string' && field.fieldValue.startsWith('[')) {
                                try {
                                    processedValue = JSON.parse(field.fieldValue)
                                } catch (e) {
                                    // If parse fails, use as is
                                    processedValue = field.fieldValue
                                }
                            }
                        } else if (field.fieldType === 'DOCUMENT') {
                            // Parse document JSON
                            if (typeof field.fieldValue === 'string' && (field.fieldValue.includes('{') || field.fieldValue.includes('['))) {
                                try {
                                    processedValue = JSON.parse(field.fieldValue)
                                } catch (e) {
                                    processedValue = field.fieldValue
                                }
                            }
                        }

                        allCustomFields.push({
                            fieldId: field.fieldKey,
                            value: processedValue
                        })
                    }
                }
            }

            console.log('All custom fields to send:', allCustomFields)

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
                listId: selectedList,
                items: [itemToCreate]
            }

            // Get list details for field definitions (for output formatting)
            const listApiUrl = `${baseUrl}/external.lists/${listIdToUse}`
            const listResponse = await secureAxiosRequest({
                method: 'GET',
                url: listApiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                }
            })

            const listData = listResponse.data?.list || listResponse.data
            const fieldDefinitions = listData.fieldDefinitions || []

            // Call batch-create API
            const apiUrl = `${baseUrl}/external.items.batch-create`
            console.log('Creating', requestBody.items.length, 'item(s) via batch-create API')
            console.log('Request body:', JSON.stringify(requestBody, null, 2))

            const response = await secureAxiosRequest({
                method: 'POST',
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                },
                data: requestBody
            })

            console.log('Items created successfully')

            const createdItems = response.data?.items || []

            // Form mode - single item output
            const createdItem = createdItems[0]
            const originalItem = requestBody.items[0]

            // Format custom fields summary
            const customFieldsSummary = originalItem.customFields && originalItem.customFields.length > 0
                ? originalItem.customFields.map((cf: any) => {
                    const fieldDef = fieldDefinitions.find((f: any) => f._id === cf.fieldId)
                    const fieldName = fieldDef?.name || cf.fieldId
                    return `   ${fieldName}: ${JSON.stringify(cf.value)}`
                }).join('\n')
                : '   No custom fields'

            const outputContent = `ITEM CREATED SUCCESSFULLY
${'='.repeat(50)}

ITEM ID: ${createdItem._id}
ITEM NAME: ${createdItem.name}

LIST: ${listData.name || listIdToUse}
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
                listName: listData.name || '',
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
