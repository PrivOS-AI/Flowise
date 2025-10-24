import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { parseJsonBody } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

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
    inputs: INodeParams[]

    constructor() {
        this.label = 'Update Document'
        this.name = 'privosDocumentUpdate'
        this.version = 1.0
        this.type = 'PrivosDocumentUpdate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#E91E63'
        this.description = 'Update document in PrivOS'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Update Type',
                name: 'updateType',
                type: 'options',
                options: [
                    {
                        label: 'Form Fields',
                        name: 'form'
                    },
                    {
                        label: 'JSON Object',
                        name: 'json'
                    }
                ],
                default: 'form',
                description: 'Choose update method'
            },
            {
                label: 'Document ID',
                name: 'documentId',
                type: 'string',
                placeholder: 'doc_xxxxx or {{$flow.documentId}}',
                acceptVariable: true,
                description: 'Document ID to update (required)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'Title',
                name: 'title',
                type: 'string',
                placeholder: 'Updated document title or {{$flow.title}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document title (optional)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'Content',
                name: 'content',
                type: 'string',
                rows: 8,
                placeholder: '# Updated Content\n\nDocument content here or {{$flow.content}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document content (optional)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'Description',
                name: 'description',
                type: 'string',
                rows: 3,
                placeholder: 'Updated description or {{$flow.description}}',
                acceptVariable: true,
                optional: true,
                description: 'Update document description (optional)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'JSON Payload',
                name: 'jsonPayload',
                type: 'string',
                rows: 12,
                acceptVariable: true,
                placeholder: `{
  "documentId": "670123456789abcdef123456",
  "title": "Updated Marketing Strategy 2025",
  "content": "# Updated Content\\n\\n## Section 1\\nContent here...",
  "description": "Updated description"
}`,
                description: 'Full JSON payload. Can use {{variables}}',
                show: {
                    updateType: ['json']
                }
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const updateType = (nodeData.inputs?.updateType as string) || 'form'
        const documentId = nodeData.inputs?.documentId as string
        const title = nodeData.inputs?.title as string
        const content = nodeData.inputs?.content as string
        const description = nodeData.inputs?.description as string
        const jsonPayload = nodeData.inputs?.jsonPayload as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            let payload: any
            let targetDocumentId: string

            // Build payload based on update type
            if (updateType === 'json') {
                // JSON mode: Parse JSON payload
                if (!jsonPayload) {
                    throw new Error('JSON Payload is required when using JSON Object mode')
                }

                payload = typeof jsonPayload === 'string' ? parseJsonBody(jsonPayload) : jsonPayload

                // Validate payload has documentId
                if (!payload.documentId) {
                    throw new Error('JSON payload must have "documentId" field')
                }

                targetDocumentId = payload.documentId
            } else {
                // Form mode: Build from form fields
                if (!documentId) {
                    throw new Error('Document ID is required')
                }

                targetDocumentId = documentId
                payload = {
                    documentId: documentId
                }

                // Add optional fields
                if (title) {
                    payload.title = title
                }

                if (content) {
                    payload.content = content
                }

                if (description) {
                    payload.description = description
                }
            }

            // Build API URL with documentId
            const apiUrl = `https://privos-chat-dev.roxane.one/api/v1/external.documents/${targetDocumentId}`

            // Prepare headers
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            console.log('Privos Document Update Request:')
            console.log('URL:', apiUrl)
            console.log('Payload:', JSON.stringify(payload, null, 2))

            // Send PUT request
            const response = await secureAxiosRequest({
                method: 'PUT',
                url: apiUrl,
                headers: requestHeaders,
                data: payload
            })

            console.log('Privos API Response:')
            console.log('Status:', response.status)
            console.log('Data:', JSON.stringify(response.data, null, 2))

            // Prepare output with updated fields
            const updatedFields: string[] = []
            if (payload.title) updatedFields.push('title')
            if (payload.content) updatedFields.push('content')
            if (payload.description) updatedFields.push('description')

            const outputData = {
                documentId: targetDocumentId,
                updated: true,
                updatedFields: updatedFields,
                ...(payload.title && { title: payload.title }),
                ...(payload.description && { description: payload.description }),
                response: response.data
            }

            const outputContent = `Document ${targetDocumentId} updated successfully. Updated fields: ${updatedFields.join(', ') || 'none'}`

            // Return standard agentflow output format
            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: { documentId: targetDocumentId },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

            return returnOutput
        } catch (error: any) {
            console.error('Privos Document Update Error:', error)

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
                input: { documentId: documentId || 'unknown' },
                output: errorOutput,
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosDocumentUpdate_Agentflow }
