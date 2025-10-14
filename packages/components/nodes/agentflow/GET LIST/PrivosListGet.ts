import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

// Global cache for rooms (keyed by credentialId)
const roomsCacheList: Map<string, { rooms: any[], timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchRoomsFromAPIList(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
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

class PrivosListGet_Agentflow implements INode {
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
        this.label = 'Get Item from List'
        this.name = 'privosListGet'
        this.version = 3.0
        this.type = 'PrivosListGet'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#9C27B0'
        this.description = 'Get item details from a list in PrivOS'
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
                description: 'Select a stage to view its items'
            },
            {
                label: 'Select Item',
                name: 'selectedItem',
                type: 'asyncOptions',
                loadMethod: 'listItems',
                refresh: true,
                description: 'Select an item to fetch its details'
            },
            {
                label: 'Return Format',
                name: 'returnFormat',
                type: 'options',
                options: [
                    {
                        label: 'Basic Info (Text)',
                        name: 'simple',
                        description: 'Name, key, and description only'
                    },
                    {
                        label: 'Full Item Details (Formatted Text)',
                        name: 'full',
                        description: 'All item info including custom fields'
                    }
                ],
                default: 'full',
                description: 'Choose how to display the item'
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
                console.log('Credential ID:', credentialId || 'EMPTY')

                if (!credentialId) {
                    console.error('No credential ID found!')
                    return returnData
                }

                console.log('Loading credential from database...')
                const credentialData = await getCredentialData(credentialId, options)

                if (!credentialData || Object.keys(credentialData).length === 0) {
                    console.error('No credential data returned from database!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken in credential')
                    return returnData
                }

                // Create cache key
                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()

                // Check cache
                const cached = roomsCacheList.get(cacheKey)
                let rooms: any[]

                if (cached && (now - cached.timestamp < CACHE_TTL)) {
                    console.log('Using cached rooms')
                    rooms = cached.rooms
                } else {
                    console.log('Fetching fresh rooms from API')
                    rooms = await fetchRoomsFromAPIList(baseUrl, userId, authToken)

                    // Update cache
                    roomsCacheList.set(cacheKey, {
                        rooms,
                        timestamp: now
                    })
                }

                // Convert to options format
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
                console.log('Selected room:', selectedRoom || 'EMPTY')

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

                for (const list of lists) {
                    const stageCount = list.stageCount || 0
                    const itemCount = list.itemCount || 0

                    returnData.push({
                        label: list.name,
                        name: list._id,
                        description: `${stageCount} stages, ${itemCount} items`
                    })
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
                console.log('Selected list:', selectedList || 'EMPTY')

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

        async listItems(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listItems] START')

                const selectedStage = nodeData.inputs?.selectedStage as string
                const selectedList = nodeData.inputs?.selectedList as string
                console.log('Selected stage:', selectedStage || 'EMPTY')
                console.log('Selected list:', selectedList || 'EMPTY')

                if (!selectedStage) {
                    console.log('No stage selected yet')
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

                // Get items by stageId
                const apiUrl = `${baseUrl}/external.items.byStageId`
                console.log('Fetching items from:', apiUrl)

                const response = await secureAxiosRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'X-Auth-Token': authToken
                    },
                    params: {
                        stageId: selectedStage,
                        limit: 100
                    }
                })

                const items = response.data?.items || []
                console.log('Items found:', items.length)

                for (const item of items) {
                    const key = item.key || ''
                    const description = item.description ? item.description.substring(0, 80) + '...' : 'No description'

                    returnData.push({
                        label: `${item.name}${key ? ` (${key})` : ''}`,
                        name: item._id,
                        description: description
                    })
                }

                console.log('Returning', returnData.length, 'item options')
                return returnData

            } catch (error: any) {
                console.error('[listItems] Error:', error.message)
                return returnData
            }
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedItem = nodeData.inputs?.selectedItem as string
        const selectedList = nodeData.inputs?.selectedList as string
        const selectedStage = nodeData.inputs?.selectedStage as string
        const returnFormat = nodeData.inputs?.returnFormat as string || 'full'

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            if (!selectedItem) {
                throw new Error('Please select an item')
            }

            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const baseUrl = getCredentialParam('baseUrl', credentialData, nodeData) || 'https://privos-dev-web.roxane.one/api/v1'
            const userId = getCredentialParam('userId', credentialData, nodeData)
            const authToken = getCredentialParam('authToken', credentialData, nodeData)

            if (!userId || !authToken) {
                throw new Error('Missing credentials: User ID and Auth Token are required')
            }

            // Fetch item details
            const apiUrl = `${baseUrl}/external.items.info`
            console.log('Fetching item details:', selectedItem)

            const response = await secureAxiosRequest({
                method: 'GET',
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                },
                params: {
                    itemId: selectedItem
                }
            })

            console.log('Item fetched successfully')

            const item = response.data?.item || response.data

            // Get list and stage names from API response first, fallback to fetching
            let listName = response.data?.listName || 'Unknown List'
            let stageName = response.data?.stageName || 'Unknown Stage'
            let fieldDefinitions: any[] = []

            // If names are not in response, fetch them from the list details
            if (listName === 'Unknown List' || stageName === 'Unknown Stage') {
                try {
                    console.log('Fetching list details for names...')
                    const listApiUrl = `${baseUrl}/external.lists/${selectedList}`
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
                    const stages = listResponse.data?.stages || []

                    // Get list name
                    if (listName === 'Unknown List' && listData.name) {
                        listName = listData.name
                    }

                    // Get stage name from stages array
                    if (stageName === 'Unknown Stage') {
                        const stageData = stages.find((s: any) => s._id === selectedStage)
                        if (stageData?.name) {
                            stageName = stageData.name
                        }
                    }

                    // Get field definitions for custom fields formatting
                    fieldDefinitions = listData.fieldDefinitions || []

                    console.log('List name:', listName)
                    console.log('Stage name:', stageName)
                } catch (err: any) {
                    console.error('Error fetching list details:', err.message)
                }
            }

            // Format dates
            const formatDate = (dateString: any) => {
                if (!dateString) return 'N/A'
                try {
                    return new Date(dateString).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                } catch {
                    return dateString
                }
            }

            const formatUser = (user: any) => {
                if (!user) return 'Unknown'
                return user.name || user.username || user._id || 'Unknown'
            }

            // Format custom fields
            const formatCustomFields = (customFields: any[], fieldDefinitions: any[]) => {
                if (!customFields || customFields.length === 0) {
                    return '   No custom fields'
                }

                const lines: string[] = []
                for (const cf of customFields) {
                    // Find field definition
                    const fieldDef = fieldDefinitions?.find((fd: any) => fd._id === cf.fieldId)
                    const fieldName = fieldDef?.name || cf.fieldId
                    const fieldType = fieldDef?.type || 'UNKNOWN'

                    // Skip null/empty values
                    if (cf.value === null || cf.value === undefined || cf.value === '') continue
                    if (Array.isArray(cf.value) && cf.value.length === 0) continue

                    // Format value based on type
                    let formattedValue: string
                    if (fieldType === 'DATE') {
                        formattedValue = formatDate(cf.value)
                    } else if (fieldType === 'USER') {
                        formattedValue = Array.isArray(cf.value)
                            ? cf.value.map((u: any) => formatUser(u)).join(', ')
                            : formatUser(cf.value)
                    } else if (fieldType === 'DOCUMENT') {
                        formattedValue = Array.isArray(cf.value)
                            ? cf.value.map((d: any) => d.title || 'Untitled').join(', ')
                            : typeof cf.value === 'object' ? cf.value.title || 'Untitled' : String(cf.value)
                    } else if (Array.isArray(cf.value)) {
                        formattedValue = cf.value.join(', ')
                    } else if (typeof cf.value === 'object') {
                        formattedValue = JSON.stringify(cf.value)
                    } else {
                        formattedValue = String(cf.value)
                    }

                    lines.push(`   ${fieldName}: ${formattedValue}`)
                }

                return lines.length > 0 ? lines.join('\n') : '   No custom fields with values'
            }

            let outputContent: string
            let outputData: any

            if (returnFormat === 'simple') {
                // Basic info only
                const name = item.name || 'Untitled'
                const key = item.key || 'N/A'
                const description = item.description || 'No description'

                outputContent = `ITEM: ${name}

KEY: ${key}

LIST: ${listName}
STAGE: ${stageName}

DESCRIPTION:
${description}`

                outputData = {
                    itemId: selectedItem,
                    name: name,
                    key: key,
                    listName: listName,
                    stageName: stageName,
                    description: description
                }
            } else {
                // Full format - Text dễ đọc
                const name = item.name || 'Untitled'
                const key = item.key || 'N/A'
                const description = item.description || 'No description'
                const creator = formatUser(item.createdBy)
                const createdDate = formatDate(item.createdAt)
                const updatedDate = formatDate(item._updatedAt)
                const order = item.order ?? 'N/A'

                // Get field definitions from list (if available)
                const customFieldsText = formatCustomFields(item.customFields || [], fieldDefinitions)

                outputContent = `ITEM DETAILS
${'='.repeat(50)}

NAME: ${name}
KEY: ${key}

LIST: ${listName}
STAGE: ${stageName}

DESCRIPTION:
${description}

${'='.repeat(50)}
METADATA:
${'='.repeat(50)}

Created by: ${creator}
Created at: ${createdDate}

Last updated at: ${updatedDate}

Order in stage: ${order}

${'='.repeat(50)}
CUSTOM FIELDS:
${'='.repeat(50)}

${customFieldsText}

${'='.repeat(50)}`

                outputData = {
                    itemId: selectedItem,
                    name: name,
                    key: key,
                    listName: listName,
                    stageName: stageName,
                    description: description,
                    listId: item.listId,
                    stageId: item.stageId,
                    parentId: item.parentId,
                    order: item.order,
                    createdAt: item.createdAt,
                    createdBy: item.createdBy,
                    updatedAt: item._updatedAt,
                    customFields: item.customFields
                }
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: { itemId: selectedItem },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

        } catch (error: any) {
            console.error('Error:', error)

            const errorMessage = error.message || 'Unknown error'
            return {
                id: nodeData.id,
                name: this.name,
                input: { itemId: selectedItem || 'none' },
                output: {
                    content: errorMessage,
                    error: errorMessage,
                    details: error.response?.data || null,
                    statusCode: error.response?.status || 500
                },
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosListGet_Agentflow }
