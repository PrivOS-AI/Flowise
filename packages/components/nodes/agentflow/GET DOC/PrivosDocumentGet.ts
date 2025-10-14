import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

// Global cache for rooms (keyed by credentialId)
const roomsCache: Map<string, { rooms: any[], timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchRoomsFromAPI(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
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

class PrivosDocumentGet_Agentflow implements INode {
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
        this.label = 'Get Document'
        this.name = 'privosDocumentGet'
        this.version = 3.0
        this.type = 'PrivosDocumentGet'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#FF9800'
        this.description = 'Get document content from PrivOS'
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
                description: 'Select a room to view its documents'
            },
            {
                label: 'Select Document',
                name: 'selectedDocument',
                type: 'asyncOptions',
                loadMethod: 'listDocuments',
                refresh: true,
                description: 'Select a document to fetch its content'
            },
            {
                label: 'Return Format',
                name: 'returnFormat',
                type: 'options',
                options: [
                    {
                        label: 'Content Only (Text)',
                        name: 'content',
                        description: 'Only return document content'
                    },
                    {
                        label: 'Full Document Info (Formatted Text)',
                        name: 'full',
                        description: 'Return title, metadata, and content in readable format'
                    }
                ],
                default: 'full',
                description: 'Choose how to display the document'
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listRooms(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listRooms] START')

                // Get credential ID from nodeData (passed from UI via requestBody.credential)
                const credentialId = nodeData.credential || ''
                console.log('Credential ID:', credentialId || 'EMPTY')

                if (!credentialId) {
                    console.error('No credential ID found!')
                    console.error('Make sure you have selected a Privos API credential in the node')
                    return returnData
                }

                // Load credential data from database
                console.log('Loading credential from database...')
                const credentialData = await getCredentialData(credentialId, options)

                if (!credentialData || Object.keys(credentialData).length === 0) {
                    console.error('No credential data returned from database!')
                    console.error('Tried credentialId:', credentialId)
                    return returnData
                }

                console.log('Credential loaded with keys:', Object.keys(credentialData))

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                console.log('Credential values:')
                console.log('- baseUrl:', baseUrl)
                console.log('- userId:', userId ? 'EXISTS' : 'MISSING')
                console.log('- authToken:', authToken ? 'EXISTS' : 'MISSING')

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken in credential')
                    return returnData
                }

                // Create cache key
                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()

                // Check cache
                const cached = roomsCache.get(cacheKey)
                let rooms: any[]

                if (cached && (now - cached.timestamp < CACHE_TTL)) {
                    console.log('Using cached rooms')
                    rooms = cached.rooms
                } else {
                    console.log('Fetching fresh rooms from API')
                    rooms = await fetchRoomsFromAPI(baseUrl, userId, authToken)

                    // Update cache
                    roomsCache.set(cacheKey, {
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
                console.error('Error stack:', error.stack)
                return returnData
            }
        },

        async listDocuments(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                console.log('[listDocuments] START')
                console.log('nodeData.inputs:', nodeData.inputs)

                const selectedRoom = nodeData.inputs?.selectedRoom as string
                console.log('Selected room:', selectedRoom || 'EMPTY')

                if (!selectedRoom) {
                    console.log('No room selected yet')
                    return returnData
                }

                // Get credential ID from nodeData (same as listRooms)
                const credentialId = nodeData.credential || ''
                console.log('Credential ID:', credentialId || 'EMPTY')

                if (!credentialId) {
                    console.error('No credential ID found for listDocuments!')
                    return returnData
                }

                console.log('Loading credential...')
                const credentialData = await getCredentialData(credentialId, options)

                if (!credentialData || Object.keys(credentialData).length === 0) {
                    console.error('No credential data found!')
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || 'https://privos-dev-web.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                console.log('Credentials loaded:')
                console.log('- baseUrl:', baseUrl)
                console.log('- userId:', userId ? 'EXISTS' : 'MISSING')
                console.log('- authToken:', authToken ? 'EXISTS' : 'MISSING')

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                const apiUrl = `${baseUrl}/external.documents.byRoomId`
                console.log('Fetching documents from:', apiUrl)
                console.log('Params:', { roomId: selectedRoom, offset: 0, count: 100 })

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

                console.log('Response status:', response.status)
                console.log('Response data keys:', Object.keys(response.data || {}))

                const documents = response.data?.documents || []
                console.log('Documents found:', documents.length)

                if (documents.length === 0) {
                    console.log('No documents in this room')
                } else {
                    console.log('First document sample:', documents[0]?._id, documents[0]?.title)
                }

                for (const doc of documents) {
                    const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''
                    const creator = doc.createdBy?.name || doc.createdBy?.username || 'Unknown'

                    returnData.push({
                        label: doc.title,
                        name: doc._id,
                        description: `By ${creator} on ${createdDate}`
                    })
                }

                console.log('Returning', returnData.length, 'document options')
                return returnData

            } catch (error: any) {
                console.error('[listDocuments] Error:', error.message)
                console.error('Error details:', error.response?.data || error.stack)
                return returnData
            }
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedDocument = nodeData.inputs?.selectedDocument as string
        const returnFormat = nodeData.inputs?.returnFormat as string || 'content'

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            if (!selectedDocument) {
                throw new Error('Please select a document')
            }

            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const baseUrl = getCredentialParam('baseUrl', credentialData, nodeData) || 'https://privos-dev-web.roxane.one/api/v1'
            const userId = getCredentialParam('userId', credentialData, nodeData)
            const authToken = getCredentialParam('authToken', credentialData, nodeData)

            if (!userId || !authToken) {
                throw new Error('Missing credentials: User ID and Auth Token are required')
            }

            const apiUrl = `${baseUrl}/external.documents/${selectedDocument}`

            console.log('Fetching document:', selectedDocument)

            const response = await secureAxiosRequest({
                method: 'GET',
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                }
            })

            console.log('Document fetched successfully')

            const document = response.data?.document || response.data
            const content = document?.content || ''

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

            let outputContent: string
            let outputData: any

            if (returnFormat === 'content') {
                // Chỉ trả về content
                outputContent = content
                outputData = { content }
            } else {
                // Full format - Text dễ đọc
                const title = document?.title || 'Untitled'
                const description = document?.description || ''
                const creator = formatUser(document?.createdBy)
                const updater = formatUser(document?.updatedBy)
                const createdDate = formatDate(document?.createdAt)
                const updatedDate = formatDate(document?.updatedAt)
                const version = document?.currentVersion || 1

                outputContent = `📄 DOCUMENT INFORMATION
${'='.repeat(50)}

📌 Title: ${title}

📝 Description: ${description || 'No description'}

👤 Created by: ${creator}
📅 Created at: ${createdDate}

👤 Last updated by: ${updater}
📅 Last updated at: ${updatedDate}

📋 Version: ${version}

${'='.repeat(50)}
📖 CONTENT:
${'='.repeat(50)}

${content}

${'='.repeat(50)}`

                outputData = {
                    documentId: selectedDocument,
                    title: title,
                    content: content,
                    description: description,
                    createdAt: document?.createdAt,
                    createdBy: document?.createdBy,
                    updatedAt: document?.updatedAt,
                    updatedBy: document?.updatedBy,
                    currentVersion: version
                }
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: { documentId: selectedDocument },
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
                input: { documentId: selectedDocument || 'none' },
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

module.exports = { nodeClass: PrivosDocumentGet_Agentflow }
