import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getCredentialData, getCredentialParam, parseJsonBody } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

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
        this.label = 'Create Items in List'
        this.name = 'privosBatchCreate'
        this.version = 1.0
        this.type = 'PrivosBatchCreate'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#4CAF50'
        this.description = 'Create items in PrivOS list'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi'],
            optional: true
        }
        this.inputs = [
            {
                label: 'Body Type',
                name: 'bodyType',
                type: 'options',
                options: [
                    {
                        label: 'Items Array (Form)',
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
                label: 'List ID',
                name: 'listId',
                type: 'string',
                placeholder: 'list_xxxxx hoặc {{$flow.listId}}',
                acceptVariable: true,
                description: 'List ID - can use variable',
                show: {
                    bodyType: ['array']
                }
            },
            {
                label: 'Items Data',
                name: 'itemsData',
                type: 'array',
                acceptVariable: true,
                array: [
                    {
                        label: 'Name',
                        name: 'name',
                        type: 'string',
                        placeholder: 'Task name OR {{$flow.taskName}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Description',
                        name: 'description',
                        type: 'string',
                        rows: 3,
                        placeholder: 'Description OR {{$flow.description}}',
                        acceptVariable: true
                    },
                    {
                        label: 'Stage ID',
                        name: 'stageId',
                        type: 'string',
                        placeholder: 'stage_xxxxx OR {{$flow.stageId}}',
                        acceptVariable: true
                    }
                ],
                description: 'List of items to create. Can use {{variables}} from previous nodes',
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
  "listId": "list_xxxxx",
  "items": [
    {
      "name": "Task 1",
      "description": "Description 1",
      "stageId": "stage_001"
    },
    {
      "name": "Task 2",
      "description": "Description 2",
      "stageId": "stage_001"
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
        const itemsData = nodeData.inputs?.itemsData as ICommonObject[]
        const listId = nodeData.inputs?.listId as string
        const jsonBody = nodeData.inputs?.jsonBody as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            let payload: any
            const apiUrl = 'https://privos-dev-web.roxane.one/api/v1/external.items.batch-create'
            let apiToken = ''
            let credListId = ''

            // Lấy credentials nếu có
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            if (credentialData && Object.keys(credentialData).length !== 0) {
                apiToken = getCredentialParam('apiToken', credentialData, nodeData) || ''
                credListId = getCredentialParam('listId', credentialData, nodeData) || ''
            }

            // Xử lý theo body type
            if (bodyType === 'json') {
                // Mode JSON: Parse JSON body
                if (!jsonBody) {
                    throw new Error('JSON Body is required when selecting JSON Object mode')
                }
                
                payload = typeof jsonBody === 'string' ? parseJsonBody(jsonBody) : jsonBody
                
                // Validate payload có listId và items
                if (!payload.listId) {
                    throw new Error('JSON payload must have "listId" field')
                }
                if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
                    throw new Error('JSON payload must have "items" field (array not empty)')
                }
                
            } else {
                // Mode Array: Xây dựng từ form
                const finalListId = listId || credListId
                if (!finalListId) {
                    throw new Error('List ID is required (from input or credential)')
                }

                if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
                    throw new Error('Items Data is required and must have at least 1 item')
                }

                // Xây dựng items array
                const items = itemsData.map(item => {
                    if (!item.name) {
                        throw new Error('Each item must have a name')
                    }
                    if (!item.stageId) {
                        throw new Error('Each item must have a stageId')
                    }
                    
                    return {
                        name: item.name,
                        description: item.description || '',
                        stageId: item.stageId
                    }
                })

                // Xây dựng payload
                payload = {
                    listId: finalListId,
                    items: items
                }
            }

            // Chuẩn bị headers
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            // Thêm Authorization
            if (apiToken) {
                requestHeaders['Authorization'] = `Bearer ${apiToken}`
            }

            console.log('Privos Batch Create Request:')
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

            // Prepare output - return thông tin chứ không lưu vào state
            const outputData = {
                listId: payload.listId,
                itemsCreated: payload.items.length,
                items: payload.items.map((item: any) => ({
                    name: item.name,
                    description: item.description,
                    stageId: item.stageId
                })),
                response: response.data
            }

            const outputContent = JSON.stringify(outputData, null, 2)

            // Return standard agentflow output format - không lưu vào state
            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: { listId: payload.listId, itemsCount: payload.items.length },
                output: {
                    content: outputContent,
                    ...outputData
                },
                state
            }

            return returnOutput

        } catch (error: any) {
            console.error('Privos Batch Create Error:', error)

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
                input: { listId: listId || 'unknown' },
                output: errorOutput,
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosBatchCreate_Agentflow }
