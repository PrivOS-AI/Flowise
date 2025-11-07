import { ICommonObject, INode, INodeData, INodeParams, INodeOptionsValue } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'
import { PRIVOS_ENDPOINTS, PRIVOS_HEADERS, CONTENT_TYPES, ERROR_MESSAGES, DEFAULT_PRIVOS_API_BASE_URL, CACHE_TTL } from '../constants'

// Cache for rooms list to reduce API calls
const roomsCache = new Map<
    string,
    {
        rooms: any[]
        timestamp: number
    }
>()

// Helper function to fetch rooms from API
async function fetchRoomsFromAPI(baseUrl: string, userId: string, authToken: string): Promise<any[]> {
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
}

class PrivosDocumentUpdate_Agentflow implements INode {
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
        this.label = 'Update Document'
        this.name = 'privosDocumentUpdate'
        this.version = 2.0
        this.type = 'PrivosDocumentUpdate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#E91E63'
        this.description = 'Update document in PrivOS room'
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
                description: 'Select a document to update. Current values will auto-fill below.',
                autoFillConfig: {
                    fieldsToFill: [
                        {
                            targetField: 'title',
                            sourcePath: 'title'
                        },
                        {
                            targetField: 'content',
                            sourcePath: 'content'
                        },
                        {
                            targetField: 'description',
                            sourcePath: 'description'
                        }
                    ]
                }
            },
            {
                label: 'Title',
                name: 'title',
                type: 'string',
                placeholder: 'Updated document title or {{$flow.title}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document title (optional)'
            },
            {
                label: 'Content',
                name: 'content',
                type: 'string',
                rows: 8,
                placeholder: '# Updated Content\n\nDocument content here or {{$flow.content}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document content (optional)'
            },
            {
                label: 'Description',
                name: 'description',
                type: 'string',
                rows: 3,
                placeholder: 'Updated description or {{$flow.description}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document description (optional)'
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listRooms(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                // Get credential ID from nodeData
                const credentialId = nodeData.credential || ''

                if (!credentialId) {
                    return returnData
                }

                // Load credential data from database
                const credentialData = await getCredentialData(credentialId, options)

                if (!credentialData || Object.keys(credentialData).length === 0) {
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    return returnData
                }

                // Check cache
                const cacheKey = `${userId}:${baseUrl}`
                const cached = roomsCache.get(cacheKey)
                const now = Date.now()

                let rooms: any[]

                if (cached && now - cached.timestamp < CACHE_TTL) {
                    rooms = cached.rooms
                } else {
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

                return returnData
            } catch (error: any) {
                return returnData
            }
        },

        async listDocuments(nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            try {
                const selectedRoom = nodeData.inputs?.selectedRoom as string

                if (!selectedRoom) {
                    return returnData
                }

                // Get credential ID from nodeData
                const credentialId = nodeData.credential || ''

                if (!credentialId) {
                    return returnData
                }

                const credentialData = await getCredentialData(credentialId, options)

                if (!credentialData || Object.keys(credentialData).length === 0) {
                    return returnData
                }

                const baseUrl = credentialData.baseUrl || DEFAULT_PRIVOS_API_BASE_URL
                const userId = credentialData.userId
                const authToken = credentialData.authToken

                if (!userId || !authToken) {
                    return returnData
                }

                const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.DOCUMENTS_BY_ROOM_ID}`

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
                        offset: 0,
                        count: 100
                    }
                })

                const documents = response.data?.documents || []

                for (const doc of documents) {
                    const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''
                    const creator = doc.createdBy?.name || doc.createdBy?.username || 'Unknown'

                    // Store full document object as JSON for autoFill
                    returnData.push({
                        label: doc.title,
                        name: JSON.stringify(doc), // Store full doc object
                        description: `By ${creator} on ${createdDate}`
                    })
                }

                return returnData
            } catch (error: any) {
                return returnData
            }
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedDocumentStr = nodeData.inputs?.selectedDocument as string
        let title = nodeData.inputs?.title as string
        let content = nodeData.inputs?.content as string
        let description = nodeData.inputs?.description as string

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

            // Validate selectedDocument
            if (!selectedDocumentStr) {
                throw new Error('Please select a document to update')
            }

            // Parse document object from JSON string
            let currentDoc: any
            try {
                currentDoc = JSON.parse(selectedDocumentStr)
            } catch (e) {
                throw new Error('Invalid document data')
            }

            const documentId = currentDoc._id

            // If any field is not provided, use current values from document
            if (!title) title = currentDoc.title
            if (!content) content = currentDoc.content
            if (!description) description = currentDoc.description

            // Build payload
            const payload: any = {
                documentId: documentId
            }

            // Add fields (will use current values if not provided by user)
            if (title) {
                payload.title = title
            }

            if (content) {
                payload.content = content
            }

            if (description) {
                payload.description = description
            }

            // Build API URL with documentId
            const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.DOCUMENTS_UPDATE}/${documentId}`

            // Prepare headers
            const requestHeaders: Record<string, string> = {
                [PRIVOS_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
                [PRIVOS_HEADERS.USER_ID]: userId,
                [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
            }

            // Send PUT request
            const response = await secureAxiosRequest({
                method: 'PUT',
                url: apiUrl,
                headers: requestHeaders,
                data: payload
            })

            // Prepare output with updated fields
            const updatedFields: string[] = []
            if (payload.title) updatedFields.push('title')
            if (payload.content) updatedFields.push('content')
            if (payload.description) updatedFields.push('description')

            const outputData = {
                documentId: documentId,
                updated: true,
                updatedFields: updatedFields,
                ...(payload.title && { title: payload.title }),
                ...(payload.description && { description: payload.description }),
                response: response.data
            }

            const outputContent = `Document updated successfully

📄 Document ID: ${documentId}
📝 Updated fields: ${updatedFields.join(', ')}
${payload.title ? `\nNew Title: ${payload.title}` : ''}
${payload.description ? `\n📋 New Description: ${payload.description}` : ''}`

            // Return standard agentflow output format
            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: { documentId: documentId },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

            return returnOutput
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error'
            const errorOutput = {
                content: `Failed to update document\n\nError: ${errorMessage}`,
                error: errorMessage,
                details: error.response?.data || null,
                statusCode: error.response?.status || 500
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: { documentId: selectedDocumentStr || 'unknown' },
                output: errorOutput,
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosDocumentUpdate_Agentflow }
