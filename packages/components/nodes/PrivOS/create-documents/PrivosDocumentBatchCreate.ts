import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

// Global cache for rooms
const roomsCachePostDoc: Map<string, { rooms: any[]; timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchRoomsFromAPIPostDoc(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
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

class PrivosDocumentBatchCreate_Agentflow implements INode {
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
        this.label = 'Create Documents'
        this.name = 'privosDocumentBatchCreate'
        this.version = 2.0
        this.type = 'PrivosDocumentBatchCreate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#2196F3'
        this.description = 'Create one or multiple documents in a Privos room'
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
                description: 'Select a room to create documents in'
            },
            {
                label: 'Documents Data',
                name: 'documentsData',
                type: 'array',
                acceptVariable: true,
                description: 'List of documents to create. Can use {{variables}} from previous nodes',
                array: [
                    {
                        label: 'Title',
                        name: 'title',
                        type: 'string',
                        placeholder: 'Document title or {{$flow.title}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Content',
                        name: 'content',
                        type: 'string',
                        rows: 5,
                        placeholder: 'Document content or {{$flow.content}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Description (Optional)',
                        name: 'description',
                        type: 'string',
                        rows: 2,
                        placeholder: 'Document description',
                        acceptVariable: true,
                        optional: true
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

                const baseUrl = credentialData.baseUrl || 'https://privos-chat-dev.roxane.one/api/v1'
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    console.error('Missing userId or authToken')
                    return returnData
                }

                // Cache rooms
                const cacheKey = `${userId}_${authToken}`
                const now = Date.now()
                const cached = roomsCachePostDoc.get(cacheKey)

                let rooms: any[]
                if (cached && now - cached.timestamp < CACHE_TTL) {
                    console.log('Using cached rooms')
                    rooms = cached.rooms
                } else {
                    console.log('Fetching fresh rooms from API')
                    rooms = await fetchRoomsFromAPIPostDoc(baseUrl, userId, authToken)
                    roomsCachePostDoc.set(cacheKey, { rooms, timestamp: now })
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
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const documentsData = nodeData.inputs?.documentsData as ICommonObject[]
        const selectedRoom = nodeData.inputs?.selectedRoom as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            // Get credentials
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const baseUrl = getCredentialParam('baseUrl', credentialData, nodeData) || 'https://privos-chat-dev.roxane.one/api/v1'
            const userId = getCredentialParam('userId', credentialData, nodeData)
            const authToken = getCredentialParam('authToken', credentialData, nodeData)

            if (!userId || !authToken) {
                throw new Error('Missing credentials: User ID and Auth Token are required')
            }

            // Validate inputs
            if (!selectedRoom) {
                throw new Error('Please select a room')
            }

            if (!documentsData || !Array.isArray(documentsData) || documentsData.length === 0) {
                throw new Error('Documents Data is required and must contain at least 1 document')
            }

            // Build documents array
            const documents = documentsData.map((doc, index) => {
                if (!doc.title || (typeof doc.title === 'string' && doc.title.trim() === '')) {
                    throw new Error(`Document #${index + 1} must have a title`)
                }
                if (!doc.content || (typeof doc.content === 'string' && doc.content.trim() === '')) {
                    throw new Error(`Document #${index + 1} must have content`)
                }

                const docPayload: any = {
                    title: doc.title,
                    content: doc.content
                }

                // Add description if provided
                if (doc.description && typeof doc.description === 'string' && doc.description.trim() !== '') {
                    docPayload.description = doc.description
                }

                return docPayload
            })

            // Build payload
            const payload = {
                roomId: selectedRoom,
                documents: documents
            }

            const apiUrl = `${baseUrl}/external.documents.batch-create`

            console.log('Privos Document Batch Create Request:')
            console.log('URL:', apiUrl)
            console.log('Payload:', JSON.stringify(payload, null, 2))

            // Send request
            const response = await secureAxiosRequest({
                method: 'POST',
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                    'X-Auth-Token': authToken
                },
                data: payload
            })

            console.log('Privos API Response:')
            console.log('Status:', response.status)
            console.log('Data:', JSON.stringify(response.data, null, 2))

            const createdDocs = response.data?.created || []
            const errors = response.data?.errors || []
            const totalCreated = response.data?.totalCreated || createdDocs.length
            const totalErrors = response.data?.totalErrors || errors.length

            // Format output nicely
            let documentsSummary = ''
            if (createdDocs.length > 0) {
                documentsSummary = createdDocs.map((doc: any, idx: number) => `   ${idx + 1}. ${doc.title} (ID: ${doc._id})`).join('\n')
            } else {
                documentsSummary = '   No documents created'
            }

            let errorsSummary = ''
            if (errors.length > 0) {
                errorsSummary = '\n\n' + '='.repeat(50) + '\n'
                errorsSummary += 'ERRORS:\n'
                errorsSummary += '='.repeat(50) + '\n'
                errorsSummary += errors.map((err: any, idx: number) => `   ${idx + 1}. ${err.title}: ${err.error}`).join('\n')
            }

            const outputContent = `DOCUMENTS CREATED SUCCESSFULLY
${'='.repeat(50)}

ROOM ID: ${selectedRoom}
TOTAL CREATED: ${totalCreated} / ${payload.documents.length}
${totalErrors > 0 ? `TOTAL ERRORS: ${totalErrors}\n` : ''}
${'='.repeat(50)}
CREATED DOCUMENTS:
${'='.repeat(50)}

${documentsSummary}${errorsSummary}

${'='.repeat(50)}

The documents have been created successfully.`

            const outputData = {
                success: true,
                roomId: selectedRoom,
                totalCreated: totalCreated,
                totalErrors: totalErrors,
                documentsCreated: createdDocs.length,
                createdDocuments: createdDocs,
                errors: errors
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    roomId: selectedRoom,
                    documentsCount: payload.documents.length
                },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }
        } catch (error: any) {
            console.error('Privos Document Batch Create Error:', error)

            const errorMessage = error.message || 'Unknown error'
            const errorDetails = error.response?.data || null

            const errorContent = `FAILED TO CREATE DOCUMENTS
${'='.repeat(50)}

ERROR: ${errorMessage}

${errorDetails ? `DETAILS: ${JSON.stringify(errorDetails, null, 2)}\n\n` : ''}${'='.repeat(50)}`

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    roomId: selectedRoom || 'unknown',
                    error: 'Failed to process request'
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

module.exports = { nodeClass: PrivosDocumentBatchCreate_Agentflow }
