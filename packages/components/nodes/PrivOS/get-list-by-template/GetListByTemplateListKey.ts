import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    processTemplateVariables,
    secureAxiosRequest
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PRIVOS_ENDPOINTS } from '../constants'
import { PrivosErrorHandler } from '../utils'

enum OutputStructureEnum {
    SINGLE = 'object',
    MAP_STAGE_TO_KEY = 'object-custom',
    FORMAT_ONLY = 'object-format'
}

class GetListByTemplateListKey_Privos implements INode {
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
    output?: INodeOutputsValue[] | undefined

    constructor() {
        this.label = 'Get List By Template LK'
        this.name = 'getListByTemplateListKeyPrivos'
        this.version = 1.0
        this.type = 'ListProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch list by template list key from Privos API'
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
                label: 'Template list key',
                name: 'templateLK',
                type: 'string',
                acceptVariable: true,
                default: 'marketing_tasks_list'
            },
            {
                label: 'Template Stage Key',
                name: 'templateStageKey',
                type: 'string',
                acceptVariable: true,
                default: 'stage_planning',
                optional: true
            },
            {
                label: 'Output Structure',
                name: 'outputStructure',
                type: 'options',
                options: [
                    { label: 'Object (Single)', name: OutputStructureEnum.SINGLE },
                    { label: 'Object (Map stageId -> templateStageKey)', name: OutputStructureEnum.MAP_STAGE_TO_KEY },
                    { label: 'Object (Format {listId, stageId} only)', name: OutputStructureEnum.FORMAT_ONLY }
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

    //@ts-ignore
    loadMethods = {
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        }
    }

    private async fetchPrivosData(baseUrl: string, apiKey: string, payload: { roomId: string; templateLK: string }) {
        const { roomId, templateLK } = payload
        const itemRes = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.LISTS_TEMPLATE_DK}?templateListKey=${templateLK}&roomId=${roomId}`,
            headers: { 'X-API-KEY': apiKey }
        })
        return itemRes.data
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { roomId, templateLK, outputStructure: type, templateStageKey, updateFLowState } = nodeData.inputs as ICommonObject
        if (!roomId) throw new Error('roomId is required')
        if (!templateLK) throw new Error('templateLK is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const result = await this.fetchPrivosData(baseUrl, apiKey, { roomId, templateLK })

            const finalOutput = this.handleOutputStructure({ type, templateStageKey }, result)
            const finalOutputString = JSON.stringify(finalOutput, null, 2)

            // Update flow state if needed
            let newState = { ...state }
            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(state, updateFLowState)
            }
            newState = processTemplateVariables(newState, finalOutputString)

            return {
                id: nodeData.id,
                name: this.name,
                input: { roomId, templateLK },
                output: { content: JSON.stringify(finalOutput, null, 2) },
                state: newState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }

    // Map stageId -> templateStageKey
    private mapStageIdToTemplateStageKey(data: any): ICommonObject {
        const stageMap: ICommonObject = {}
        if (data && data.stages && Array.isArray(data.stages)) {
            data.stages.forEach((stage: any) => {
                if (stage?._id && stage?.templateStageKey) {
                    stageMap[stage._id] = stage.templateStageKey
                }
            })
        }
        return stageMap
    }

    private handleOutputStructure({ type, templateStageKey }: { type: string; templateStageKey: string }, data: any) {
        switch (type) {
            case OutputStructureEnum.SINGLE:
                return data
            case OutputStructureEnum.MAP_STAGE_TO_KEY: {
                const stageMap = this.mapStageIdToTemplateStageKey(data)
                return {
                    items: (data?.items || []).map((it: any) => ({
                        name: it?.name ?? '',
                        description: it?.description ?? '',
                        templateStageKey: stageMap[it?.stageId] ?? null
                    }))
                }
            }
            case OutputStructureEnum.FORMAT_ONLY: {
                const stage = this.findStageByKey(data, templateStageKey)
                return {
                    listId: stage?.listId ?? data?.list?._id ?? null,
                    stageId: stage?._id ?? null
                }
            }
            default:
                return data
        }
    }

    private findStageByKey(data: any, templateStageKey: string) {
        if (data && data.stages && Array.isArray(data.stages)) {
            return data.stages.find((stage: any) => stage?.templateStageKey === templateStageKey) || null
        }
        return null
    }
}

module.exports = { nodeClass: GetListByTemplateListKey_Privos }
