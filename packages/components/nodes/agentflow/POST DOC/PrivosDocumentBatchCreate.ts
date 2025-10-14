import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { parseJsonBody } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

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
    inputs: INodeParams[]

    constructor() {
        this.label = 'Create Documents'
        this.name = 'privosDocumentBatchCreate'
        this.version = 1.0
        this.type = 'PrivosDocumentBatchCreate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#2196F3'
        this.description = 'Create documents in PrivOS'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Body Type',
                name: 'bodyType',
                type: 'options',
                options: [
                    {
                        label: 'Documents Array (Form)',
                        name: 'array'
                    },
                    {
                        label: 'JSON Object',
                        name: 'json'
                    }
                ],
                default: 'array',
                description: 'Select data entry method'
            },
            {
                label: 'Room ID',
                name: 'roomId',
                type: 'string',
                placeholder: 'room_xxxxx hoặc {{$flow.roomId}}',
                acceptVariable: true,
                description: 'Room ID - can use variable',
                show: {
                    bodyType: ['array']
                }
            },
            {
                label: 'Documents Data',
                name: 'documentsData',
                type: 'array',
                acceptVariable: true,
                array: [
                    {
                        label: 'Title',
                        name: 'title',
                        type: 'string',
                        placeholder: 'Document title OR {{$flow.title}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Content',
                        name: 'content',
                        type: 'string',
                        rows: 5,
                        placeholder: 'Nội dung document or {{$flow.content}}',
                        acceptVariable: true
                    }
                ],
                description: 'List of documents to create. Can use {{variables}} from previous nodes',
                show: {
                    bodyType: ['array']
                }
            },
            {
                label: 'JSON Body',
                name: 'jsonBody',
                type: 'string',
                rows: 10,
                acceptVariable: true,
                placeholder: `{
  "roomId": "room_xxxxx",
  "documents": [
    {
      "title": "Project Requirements",
      "content": "# Project Overview\\n\\nDetailed requirements..."
    },
    {
      "title": "Technical Specifications",
      "content": "# Technical Details\\n\\nArchitecture..."
    }
  ]
}`,
                description: 'Enter the entire JSON payload. {{variables}} is acceptable.',
                show: {
                    bodyType: ['json']
                }
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const bodyType = nodeData.inputs?.bodyType as string || 'array'
        const documentsData = nodeData.inputs?.documentsData as ICommonObject[]
        const roomId = nodeData.inputs?.roomId as string
        const jsonBody = nodeData.inputs?.jsonBody as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            let payload: any
            const apiUrl = 'https://privos-dev-web.roxane.one/api/v1/external.documents.batch-create'

            // Xử lý theo body type
            if (bodyType === 'json') {
                // Mode JSON: Parse JSON body
                if (!jsonBody) {
                    throw new Error('JSON Body is required when selecting JSON Object mode')
                }
                
                payload = typeof jsonBody === 'string' ? parseJsonBody(jsonBody) : jsonBody
                
                // Validate payload có roomId và documents
                if (!payload.roomId) {
                    throw new Error('JSON payload must have "roomId" field')
                }
                if (!payload.documents || !Array.isArray(payload.documents) || payload.documents.length === 0) {
                    throw new Error('JSON payload must have "documents" field (array not empty)')
                }
                
            } else {
                // Mode Array: Xây dựng từ form
                if (!roomId) {
                    throw new Error('Room ID is required')
                }

                if (!documentsData || !Array.isArray(documentsData) || documentsData.length === 0) {
                    throw new Error('Documents Data is required and must contain at least 1 document.')
                }

                // Xây dựng documents array
                const documents = documentsData.map(doc => {
                    if (!doc.title) {
                        throw new Error('Each document must have a title')
                    }
                    if (!doc.content) {
                        throw new Error('Each document must have a content')
                    }
                    
                    return {
                        title: doc.title,
                        content: doc.content
                    }
                })

                // Xây dựng payload
                payload = {
                    roomId: roomId,
                    documents: documents
                }
            }

            // Chuẩn bị headers
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            console.log('Privos Document Batch Create Request:')
            console.log('URL:', apiUrl)
            console.log('Payload:', JSON.stringify(payload, null, 2))

            // Gửi request
            const response = await secureAxiosRequest({
                method: 'POST',
                url: apiUrl,
                headers: requestHeaders,
                data: payload
            })

            console.log('Privos API Response:')
            console.log('Status:', response.status)
            console.log('Data:', JSON.stringify(response.data, null, 2))

            // Prepare output
            const outputData = {
                roomId: payload.roomId,
                documentsCreated: payload.documents.length,
                documents: payload.documents.map((doc: any) => doc.title),
                response: response.data
            }

            const outputContent = JSON.stringify(outputData, null, 2)

            // Return standard agentflow output format
            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: { roomId: payload.roomId, documentsCount: payload.documents.length },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

            return returnOutput

        } catch (error: any) {
            console.error('Privos Document Batch Create Error:', error)

            const errorMessage = error.message || 'Unknown error'
            const errorOutput = {
                content: errorMessage,
                error: errorMessage,
                details: error.response?.data || null,
                statusCode: error.response?.status || 500
            }

            return {
                id: nodeData.id,
                name: this.name,
                input: { roomId: roomId || 'unknown' },
                output: errorOutput,
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosDocumentBatchCreate_Agentflow }

