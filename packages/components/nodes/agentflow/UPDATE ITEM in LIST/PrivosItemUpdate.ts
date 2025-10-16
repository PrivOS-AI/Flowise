import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

// Global cache for rooms
const roomsCacheUpdateItem: Map<string, { rooms: any[], timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchRoomsFromAPI(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
    try {
        const apiUrl = `${baseUrl}/rooms.get`
        const response = await secureAxiosRequest({
            method: 'GET',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                'X-Auth-Token': authToken
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
                        {
                            targetField: 'field_assignees',
                            sourcePath: 'customFields[marketing_campaign_assignees_field].value',
                            transform: (value: any) => {
                                if (Array.isArray(value)) {
                                    // Transform to array of JSON strings as expected by AsyncDropdown list
                                    return value.map((u: any) => JSON.stringify({ _id: u._id, username: u.username }))
                                }
                                return []
                            }
                        },
                        {
                            targetField: 'field_due_date',
                            sourcePath: 'customFields[marketing_campaign_due_date_field].value',
                            transform: (value: any) => {
                                // Convert ISO date string to YYYY-MM-DD format for date input
                                if (value) {
                                    return new Date(value).toISOString().split('T')[0]
                                }
                                return ''
                            }
                        },
                        {
                            targetField: 'field_start_date',
                            sourcePath: 'customFields[marketing_campaign_start_date_field].value',
                            transform: (value: any) => {
                                if (value) {
                                    return new Date(value).toISOString().split('T')[0]
                                }
                                return ''
                            }
                        },
                        {
                            targetField: 'field_end_date',
                            sourcePath: 'customFields[marketing_campaign_end_date_field].value',
                            transform: (value: any) => {
                                if (value) {
                                    return new Date(value).toISOString().split('T')[0]
                                }
                                return ''
                            }
                        },
                        {
                            targetField: 'field_documents',
                            sourcePath: 'customFields[marketing_campaign_documents_field].value',
                            transform: (value: any) => {
                                if (Array.isArray(value)) {
                                    // Extract only title and content from each document
                                    return value.map((doc: any) => ({
                                        title: doc.title || '',
                                        content: doc.content || (doc.versions && doc.versions[0] ? doc.versions[0].content : '')
                                    }))
                                }
                                return []
                            }
                        },
                        {
                            targetField: 'field_note',
                            sourcePath: 'customFields[marketing_campaign_note_field].value'
                        },
                        {
                            targetField: 'customFields',
                            sourcePath: 'customFields',
                            transform: (value: any) => {
                                if (!Array.isArray(value)) return []

                                // List of 7 hardcoded field IDs to exclude
                                const excludedFieldIds = [
                                    'marketing_campaign_assignees_field',
                                    'marketing_campaign_due_date_field',
                                    'marketing_campaign_start_date_field',
                                    'marketing_campaign_end_date_field',
                                    'marketing_campaign_file_link_field',
                                    'marketing_campaign_documents_field',
                                    'marketing_campaign_note_field'
                                ]

                                // Filter out the 7 hardcoded fields, keep only additional fields
                                const additionalFields = value.filter((field: any) =>
                                    !excludedFieldIds.includes(field.fieldId)
                                )

                                // Transform to Additional Custom Fields format
                                return additionalFields.map((field: any) => {
                                    let fieldValue = field.value
                                    let fieldType = 'TEXT' // Default type

                                    // Detect field type based on value
                                    if (typeof fieldValue === 'object' && fieldValue !== null) {
                                        fieldValue = JSON.stringify(fieldValue)
                                        fieldType = 'TEXT'
                                    } else if (typeof fieldValue === 'number') {
                                        fieldValue = String(fieldValue)
                                        fieldType = 'NUMBER'
                                    } else if (typeof fieldValue === 'boolean') {
                                        fieldValue = String(fieldValue)
                                        fieldType = 'CHECKBOX'
                                    } else if (typeof fieldValue === 'string') {
                                        // Check if it's a date
                                        if (/^\d{4}-\d{2}-\d{2}/.test(fieldValue)) {
                                            fieldType = 'DATE'
                                        } else if (fieldValue.length > 100) {
                                            fieldType = 'TEXTAREA'
                                        } else {
                                            fieldType = 'TEXT'
                                        }
                                    }

                                    return {
                                        fieldType: fieldType,
                                        fieldKey: field.fieldId,
                                        fieldValue: fieldValue || ''
                                    }
                                })
                            }
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
            // === 7 HARDCODED FIELD DEFINITIONS ===
            {
                label: '1. Assignees (USER type)',
                name: 'field_assignees',
                type: 'asyncOptions',
                loadMethod: 'listUsers',
                list: true,
                optional: true,
                description: 'Update assignees (leave empty to keep current) - fieldId: marketing_campaign_assignees_field'
            },
            {
                label: '2. Due Date (DATE type)',
                name: 'field_due_date',
                type: 'date',
                optional: true,
                description: 'Update due date (leave empty to keep current) - fieldId: marketing_campaign_due_date_field'
            },
            {
                label: '3. Start Date (DATE type)',
                name: 'field_start_date',
                type: 'date',
                optional: true,
                description: 'Update start date (leave empty to keep current) - fieldId: marketing_campaign_start_date_field'
            },
            {
                label: '4. End Date (DATE type)',
                name: 'field_end_date',
                type: 'date',
                optional: true,
                description: 'Update end date (leave empty to keep current) - fieldId: marketing_campaign_end_date_field'
            },
            {
                label: '5. File (FILE type)',
                name: 'field_file',
                type: 'file',
                optional: true,
                description: 'Update file (leave empty to keep current) - fieldId: marketing_campaign_file_link_field'
            },
            {
                label: '6. Documents',
                name: 'field_documents',
                type: 'array',
                acceptVariable: true,
                optional: true,
                description: 'Update documents (leave empty to keep current) - fieldId: marketing_campaign_documents_field',
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
                description: 'Update note (leave empty to keep current) - fieldId: marketing_campaign_note_field'
            },
            // === ADDITIONAL CUSTOM FIELDS ===
            {
                label: 'Additional Custom Fields',
                name: 'customFields',
                type: 'array',
                acceptVariable: true,
                optional: true,
                description: 'Update additional custom fields beyond the 7 fixed fields',
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
                const credentialId = nodeData.credential || ''
                if (!credentialId) return returnData

                const credentialData = await getCredentialData(credentialId, options)
                if (!credentialData || Object.keys(credentialData).length === 0) return returnData

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) return returnData

                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()
                const cached = roomsCacheUpdateItem.get(cacheKey)

                let rooms: any[]
                if (cached && (now - cached.timestamp < CACHE_TTL)) {
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('[listLists] Missing userId or authToken')
                    return returnData
                }

                const apiUrl = `${baseUrl}/external.lists.byRoomId`
                console.log('[listLists] API URL:', apiUrl, 'roomId:', selectedRoom)

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
                console.log('[listLists] Found', lists.length, 'lists')

                // Store roomId in each list option for later use
                for (const list of lists) {
                    returnData.push({
                        label: list.name || list._id,
                        name: JSON.stringify({ listId: list._id, roomId: list.roomId || selectedRoom }), // Store both listId and roomId
                        description: list.description || `${list.stageCount || 0} stages, ${list.itemCount || 0} items`
                    })
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) return returnData

                // Get list details to fetch stages
                const apiUrl = `${baseUrl}/external.lists/${listId}`
                console.log('[listStages] Fetching list details from:', apiUrl)

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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
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
                    apiUrl = `${baseUrl}/external.items.byStageId`
                    apiParams = {
                        stageId: selectedStage,
                        limit: 100
                    }
                    console.log('[listItems] Fetching items by stageId:', selectedStage)
                } else {
                    // Use byListId endpoint to get all items in list
                    apiUrl = `${baseUrl}/external.items.byListId`
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
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
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
                    const otherFields = customFields.filter((f: any) =>
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

                    // Augment item with roomId and formatted info for later use
                    const itemWithExtras = {
                        ...item,
                        __roomId: roomId, // Store roomId for listUsers to access
                        __formattedInfo: formattedInfo // Store formatted info
                    }

                    // Store full item data (with roomId and formatted info) in the name field as JSON string
                    // Build compact description for dropdown
                    const shortDesc = [
                        assigneesField?.value && Array.isArray(assigneesField.value) ? `👥 ${assigneesField.value.length}` : '👥 0',
                        dueDateField?.value ? `📅 ${new Date(dueDateField.value).toLocaleDateString('en-GB')}` : '📅 -',
                        fileField?.value ? '📎 ✓' : '📎 ✗',
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

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
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

                if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
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
                    case 'p': // Private group
                        apiEndpoint = `${baseUrl}/groups.members`
                        console.log('[listUsers] Using groups.members for private group')
                        break
                    case 'd': // Direct message
                        apiEndpoint = `${baseUrl}/im.members`
                        console.log('[listUsers] Using im.members for direct message')
                        break
                    case 'c': // Public channel
                    default:
                        apiEndpoint = `${baseUrl}/channels.members`
                        console.log('[listUsers] Using channels.members for public channel')
                        break
                }

                console.log('[listUsers] Fetching from:', apiEndpoint, 'with roomId:', roomId)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiEndpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
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
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedItemStr = nodeData.inputs?.selectedItem as string
        const itemName = nodeData.inputs?.itemName as string
        const itemDescription = nodeData.inputs?.itemDescription as string

        // 7 hardcoded fields
        const field_assignees = nodeData.inputs?.field_assignees as any // Can be string, array, or object
        const field_due_date = nodeData.inputs?.field_due_date as string
        const field_start_date = nodeData.inputs?.field_start_date as string
        const field_end_date = nodeData.inputs?.field_end_date as string
        const field_file = nodeData.inputs?.field_file as string
        const field_documents = nodeData.inputs?.field_documents as ICommonObject[]
        const field_note = nodeData.inputs?.field_note as string

        // Additional custom fields
        const customFields = nodeData.inputs?.customFields as ICommonObject[]

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
                console.log('📊 CURRENT ITEM INFORMATION')
                console.log('='.repeat(60))
                console.log(currentItem.__formattedInfo)
                console.log('='.repeat(60) + '\n')
            }

            const credentialId = nodeData.credential || ''
            if (!credentialId) {
                throw new Error('Credential is required')
            }

            const credentialData = await getCredentialData(credentialId, options)
            const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
            const userId = credentialData.userId
            const authToken = credentialData.authToken

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

            // Build customFields array for the 7 hardcoded fields + additional custom fields
            const allCustomFields: any[] = []

            // 1. Assignees - Process same way as POST LIST
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

                    allCustomFields.push({
                        fieldId: 'marketing_campaign_assignees_field',
                        value: validatedValue
                    })
                } catch (e) {
                    console.error('Failed to parse assignees:', e)
                    throw new Error('Invalid assignees format')
                }
            }

            // 2. Due Date
            if (field_due_date) {
                allCustomFields.push({
                    fieldId: 'marketing_campaign_due_date_field',
                    value: field_due_date
                })
            }

            // 3. Start Date
            if (field_start_date) {
                allCustomFields.push({
                    fieldId: 'marketing_campaign_start_date_field',
                    value: field_start_date
                })
            }

            // 4. End Date
            if (field_end_date) {
                allCustomFields.push({
                    fieldId: 'marketing_campaign_end_date_field',
                    value: field_end_date
                })
            }

            // 5. File - Handle file upload if provided
            if (field_file) {
                // TODO: Implement file upload logic similar to POST LIST
                console.log('File upload for UPDATE not yet implemented:', field_file)
            }

            // 6. Documents
            if (field_documents && field_documents.length > 0) {
                const documentsValue = field_documents.map(doc => ({
                    title: doc.title,
                    content: doc.content
                }))
                allCustomFields.push({
                    fieldId: 'marketing_campaign_documents_field',
                    value: documentsValue
                })
            }

            // 7. Note
            if (field_note) {
                allCustomFields.push({
                    fieldId: 'marketing_campaign_note_field',
                    value: field_note
                })
            }

            // Add additional custom fields
            if (customFields && Array.isArray(customFields) && customFields.length > 0) {
                for (const field of customFields) {
                    if (field.fieldKey && field.fieldValue) {
                        let parsedValue = field.fieldValue
                        if (typeof field.fieldValue === 'string') {
                            try {
                                parsedValue = JSON.parse(field.fieldValue)
                            } catch {
                                parsedValue = field.fieldValue
                            }
                        }
                        allCustomFields.push({
                            fieldId: field.fieldKey,
                            value: parsedValue
                        })
                    }
                }
            }

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
                    const listApiUrl = `${baseUrl}/external.lists/${listId}`
                    const listResponse = await secureAxiosRequest({
                        method: 'GET',
                        url: listApiUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-User-Id': userId,
                            'X-Auth-Token': authToken
                        }
                    })
                    listData = listResponse.data?.list || listResponse.data
                    fieldDefinitions = listData.fieldDefinitions || []
                } catch (err) {
                    console.error('Error fetching list details:', err)
                }
            }

            // Send update request
            const apiUrl = `${baseUrl}/external.items.update`
            const response = await secureAxiosRequest({
                method: 'PUT',
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                },
                data: payload
            })

            console.log('Update Item Response:', JSON.stringify(response.data, null, 2))

            const updatedItem = response.data?.item || response.data

            // Format custom fields summary
            const customFieldsSummary = allCustomFields && allCustomFields.length > 0
                ? allCustomFields.map((cf: any) => {
                    const fieldDef = fieldDefinitions.find((f: any) => f._id === cf.fieldId)
                    const fieldName = fieldDef?.name || cf.fieldId
                    
                    // Format value based on type
                    let displayValue = cf.value
                    if (Array.isArray(cf.value)) {
                        if (cf.value.length > 0 && cf.value[0]._id && cf.value[0].username) {
                            // User array
                            displayValue = cf.value.map((u: any) => `@${u.username}`).join(', ')
                        } else {
                            displayValue = JSON.stringify(cf.value)
                        }
                    } else if (typeof cf.value === 'object') {
                        displayValue = JSON.stringify(cf.value)
                    } else if (typeof cf.value === 'string' && cf.value.includes('T') && cf.value.includes('Z')) {
                        // Date
                        displayValue = new Date(cf.value).toLocaleString('en-GB')
                    }
                    
                    return `   ${fieldName}: ${displayValue}`
                }).join('\n')
                : '   No fields updated'

            const outputContent = `ITEM UPDATED SUCCESSFULLY
${'='.repeat(50)}

ITEM ID: ${itemId}
ITEM NAME: ${payload.name || currentItem.name}

LIST: ${listData.name || listId || 'Unknown'}
${payload.description ? `\nDESCRIPTION:\n${payload.description}\n` : ''}
${'='.repeat(50)}
UPDATED FIELDS:
${'='.repeat(50)}

${customFieldsSummary}

${'='.repeat(50)}

The item has been updated successfully.`

            const outputData = {
                success: true,
                itemId: itemId,
                itemName: payload.name || currentItem.name,
                listId: listId,
                listName: listData.name || '',
                updatedFieldsCount: allCustomFields.length,
                updatedItem: updatedItem
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
