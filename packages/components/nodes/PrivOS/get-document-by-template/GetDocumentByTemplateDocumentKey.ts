import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    processTemplateVariables,
    secureAxiosRequest
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PRIVOS_ENDPOINTS } from '../constants'
import { PrivosErrorHandler } from '../utils'

class GetDocumentByTemplateDocumentKey_Privos implements INode {
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

    constructor() {
        this.label = 'Get Document By Template DK'
        this.name = 'getDocumentByTemplateDocumentKeyPrivos'
        this.version = 1.0
        this.type = 'DocumentProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch document by template document key from Privos API'
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
                label: 'Room ID',
                name: 'roomId',
                type: 'string',
                acceptVariable: true
            },
            {
                label: 'Template document key',
                name: 'templateDK',
                type: 'string',
                acceptVariable: true,
                default: 'marketing_planning_document'
            },
            {
                label: 'Output Structure',
                name: 'outputStructure',
                type: 'options',
                options: [
                    { label: 'Content (string)', name: 'string' },
                    { label: 'Object (Single)', name: 'object' }
                ],
                default: 'object'
            },
            {
                label: 'Update Flow State',
                name: 'updateFLowState',
                description: 'Update runtime state during the execution of the workflow',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'asyncOptions',
                        loadMethod: 'listRuntimeStateKeys',
                        freeSolo: true
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true,
                        acceptNodeOutputAsVariable: true
                    }
                ]
            }
        ]
        this.output = [
            {
                label: 'Result Data',
                name: 'result',
                baseClasses: [this.type, 'string', 'object']
            }
        ]
    }

    private async fetchPrivosData(baseUrl: string, apiKey: string, payload: { roomId: string; templateDK: string }) {
        const { roomId, templateDK } = payload
        const itemRes = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.DOCUMENTS_TEMPLATE_DK}?templateDocumentKey=${templateDK}&roomId=${roomId}`,
            headers: { 'X-API-KEY': apiKey }
        })
        return itemRes.data?.document
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { roomId, templateDK, outputStructure, updateFLowState } = nodeData.inputs as ICommonObject
        if (!roomId) throw new Error('roomId is required')
        if (!templateDK) throw new Error('templateDK is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const result = await this.fetchPrivosData(baseUrl, apiKey, { roomId, templateDK })

            const finalOutput = outputStructure === 'object' ? result : result?.content || ''

            // Update flow state if needed
            let newState = { ...state }
            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(state, updateFLowState)
            }
            newState = processTemplateVariables(newState, finalOutput)

            return {
                id: nodeData.id,
                name: this.name,
                input: { roomId, templateDK },
                output: { content: JSON.stringify(finalOutput, null, 2) },
                state: newState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }
}

module.exports = { nodeClass: GetDocumentByTemplateDocumentKey_Privos }
