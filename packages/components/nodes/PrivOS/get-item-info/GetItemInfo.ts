import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    secureAxiosRequest
} from '../../../src'
import { PRIVOS_ENDPOINTS } from '../constants'
import { extractTextFromHtml, mapCustomFields, parseMultiSelectFields, PrivosErrorHandler } from '../utils'

class GetItemInfo_Privos implements INode {
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
    outputs: INodeOutputsValue[]
    output?: INodeOutputsValue[] | undefined

    private loadMethodCache = new Map<string, { data: INodeOptionsValue[]; timestamp: number }>()
    private readonly CACHE_TTL = 30000 // 30s

    constructor() {
        this.label = 'Get Item Info'
        this.name = 'getItemInfoPrivos'
        this.version = 1.0
        this.type = 'ItemProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch item info and select custom fields from Privos API'
        this.icon = 'privos.svg'
        this.color = '#4318FF'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi']
        }
        this.inputs = [
            {
                label: 'Item ID',
                name: 'itemId',
                type: 'string',
                acceptVariable: true
            },
            {
                label: 'Custom Fields',
                name: 'selectedFields',
                type: 'asyncMultiOptions',
                loadMethod: 'listCustomFields'
            },
            {
                label: 'Output Structure',
                name: 'outputStructure',
                type: 'options',
                options: [
                    { label: 'Array (List)', name: 'array' },
                    { label: 'Object (Single)', name: 'object' }
                ],
                default: 'object'
            }
        ]
        this.outputs = [
            {
                label: 'Item Data',
                name: 'itemResult',
                baseClasses: [this.type, 'string', 'object']
            }
        ]
        this.output = [
            {
                label: 'Item Data',
                name: 'itemResult',
                baseClasses: [this.type, 'string', 'object']
            }
        ]
    }

    private async fetchPrivosData(baseUrl: string, apiKey: string, itemId: string) {
        const headers = { 'X-API-KEY': apiKey }

        // 1. Fetch Item Info
        const itemRes = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.items.info}`,
            headers,
            params: { itemId }
        })
        const item = itemRes.data.item

        // 2. Fetch List Definitions (if listId exists)
        let listInfo = null
        if (item?.listId) {
            const listRes = await secureAxiosRequest({
                url: `${baseUrl}${PRIVOS_ENDPOINTS.lists.all}/${item.listId}`,
                headers
            })
            listInfo = listRes.data
        }

        return { item, rawData: itemRes.data, listInfo }
    }

    //@ts-ignore
    loadMethods = {
        listCustomFields: async (nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> => {
            const itemId = extractTextFromHtml(nodeData.inputs?.itemId as string)
            if (!itemId) return [{ label: 'Enter Item ID first', name: 'none' }]

            const cacheKey = `fields_${itemId}`
            const cached = this.loadMethodCache.get(cacheKey)
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data

            try {
                const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
                const { rawData, listInfo } = await this.fetchPrivosData(baseUrl, apiKey, itemId)

                const allFields = mapCustomFields(rawData, listInfo)
                const result = [
                    { label: '✓ Select All Fields', name: JSON.stringify(allFields.map((f: any) => f.fieldId)) },
                    ...allFields.map((f: any) => ({ label: f.name, name: f.fieldId, description: f.type }))
                ]

                this.loadMethodCache.set(cacheKey, { data: result, timestamp: Date.now() })
                return result
            } catch (e) {
                return [{ label: 'Error loading fields', name: 'error' }]
            }
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { itemId, outputStructure, selectedFields } = nodeData.inputs as ICommonObject
        if (!itemId) throw new Error('Item ID is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const { item, rawData, listInfo } = await this.fetchPrivosData(baseUrl, apiKey, itemId as string)

            // Process Fields
            const allCustomFields = mapCustomFields(rawData, listInfo)
            const fieldFilters = parseMultiSelectFields(selectedFields)

            const filteredFields =
                fieldFilters.length > 0 ? allCustomFields.filter((f: any) => fieldFilters.includes(f.fieldId)) : allCustomFields

            const result = {
                itemId: item?._id,
                name: item?.name || 'Unnamed',
                customFields: filteredFields
            }

            const finalOutput = outputStructure === 'object' ? result : [result]

            return {
                itemResult: finalOutput,
                id: nodeData.id,
                name: this.name,
                input: { itemId, selectedFields },
                output: { content: JSON.stringify(finalOutput, null, 2) },
                state
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }
}

module.exports = { nodeClass: GetItemInfo_Privos }
