import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { parseJsonBody } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

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
    inputs: INodeParams[]

    constructor() {
        this.label = 'Update Item in List'
        this.name = 'privosItemUpdate'
        this.version = 1.0
        this.type = 'PrivosItemUpdate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#FF5722'
        this.description = 'Update item in PrivOS'
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
                label: 'Item ID',
                name: 'itemId',
                type: 'string',
                placeholder: 'item_xxxxx or {{$flow.itemId}}',
                acceptVariable: true,
                description: 'Item ID to update (required)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'Name',
                name: 'name',
                type: 'string',
                placeholder: 'Updated item name or {{$flow.name}}',
                acceptVariable: true,
                optional: true,
                description: 'Update item name (optional)',
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
                description: 'Update item description (optional)',
                show: {
                    updateType: ['form']
                }
            },
            {
                label: 'Custom Fields',
                name: 'customFields',
                type: 'array',
                acceptVariable: true,
                optional: true,
                array: [
                    {
                        label: 'Field ID',
                        name: 'fieldId',
                        type: 'string',
                        placeholder: 'field_name or {{$flow.fieldId}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        placeholder: 'Field value or {{$flow.value}}',
                        acceptVariable: true
                    }
                ],
                description: 'Custom fields to update (optional)',
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
  "itemId": "68de5ca73e05559cd6b03ba6",
  "name": "Updated Item Name",
  "description": "Updated description",
  "customFields": [
    {
      "fieldId": "field_assignees",
      "value": ["user1", "user2"]
    },
    {
      "fieldId": "field_priority",
      "value": "high"
    }
  ]
}`,
                description: 'Full JSON payload. Can use {{variables}}',
                show: {
                    updateType: ['json']
                }
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const updateType = nodeData.inputs?.updateType as string || 'form'
        const itemId = nodeData.inputs?.itemId as string
        const name = nodeData.inputs?.name as string
        const description = nodeData.inputs?.description as string
        const customFields = nodeData.inputs?.customFields as ICommonObject[]
        const jsonPayload = nodeData.inputs?.jsonPayload as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            let payload: any
            const apiUrl = 'https://privos-dev-web.roxane.one/api/v1/external.items.update'

            // Build payload based on update type
            if (updateType === 'json') {
                // JSON mode: Parse JSON payload
                if (!jsonPayload) {
                    throw new Error('JSON Payload is required when using JSON Object mode')
                }
                
                payload = typeof jsonPayload === 'string' ? parseJsonBody(jsonPayload) : jsonPayload
                
                // Validate payload has itemId
                if (!payload.itemId) {
                    throw new Error('JSON payload must have "itemId" field')
                }
                
            } else {
                // Form mode: Build from form fields
                if (!itemId) {
                    throw new Error('Item ID is required')
                }

                payload = {
                    itemId: itemId
                }

                // Add optional name
                if (name) {
                    payload.name = name
                }

                // Add optional description
                if (description) {
                    payload.description = description
                }

                // Add custom fields if provided
                if (customFields && Array.isArray(customFields) && customFields.length > 0) {
                    payload.customFields = customFields.map(field => {
                        if (!field.fieldId) {
                            throw new Error('Each custom field must have fieldId')
                        }
                        
                        // Try to parse value as JSON (for arrays, objects, numbers)
                        let parsedValue = field.value
                        if (typeof field.value === 'string') {
                            try {
                                parsedValue = JSON.parse(field.value)
                            } catch {
                                // Keep as string if not valid JSON
                                parsedValue = field.value
                            }
                        }
                        
                        return {
                            fieldId: field.fieldId,
                            value: parsedValue
                        }
                    })
                }
            }

            // Prepare headers
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            console.log('Privos Item Update Request:')
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

            // Prepare output
            const outputData = {
                itemId: payload.itemId,
                updated: true,
                ...(payload.name && { name: payload.name }),
                ...(payload.description && { description: payload.description }),
                ...(payload.customFields && { customFieldsCount: payload.customFields.length }),
                response: response.data
            }

            const outputContent = JSON.stringify(outputData, null, 2)

            // Return standard agentflow output format
            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: { itemId: payload.itemId },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

            return returnOutput

        } catch (error: any) {
            console.error('Privos Item Update Error:', error)

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
                input: { itemId: itemId || 'unknown' },
                output: errorOutput,
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosItemUpdate_Agentflow }

