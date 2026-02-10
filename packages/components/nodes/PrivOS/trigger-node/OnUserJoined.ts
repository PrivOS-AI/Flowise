import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    processTemplateVariables
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PrivosEvent } from '../constants'
import { PrivosErrorHandler } from '../utils'

class OnUserJoined_Privos implements INode {
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
    triggerType?: string

    constructor() {
        this.label = 'On User Joined'
        this.name = 'onUserJoinedPrivos'
        this.triggerType = PrivosEvent.USER_JOINED
        this.version = 1.0
        this.type = 'triggerProcessor'
        this.category = 'Trigger'
        this.description = 'Triggers when a new user joins in Privos'
        this.icon = 'privos.svg'
        this.color = '#4318FF'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Bot PrivOS Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['botPrivosCredential']
        }
        this.inputs = [
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

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { userId, updateFLowState } = nodeData.inputs as ICommonObject
        const state = options.agentflowRuntime?.state
        if (!nodeData.credential) {
            throw new Error('Credential not found')
        }

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const payload = options.triggerData
            const inputState = {
                roomId: payload.roomId,
                userId: payload.userId
            }

            const result: any = {
                event: PrivosEvent.USER_JOINED,
                ...inputState
            }

            // Update flow state if needed
            let newState = {
                ...state,
                ...result
            }

            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(state, updateFLowState)
            }
            newState = processTemplateVariables(newState, result)

            return {
                id: nodeData.id,
                name: this.name,
                input: { userId },
                output: { content: JSON.stringify(result, null, 2) },
                state: newState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }
}

module.exports = { nodeClass: OnUserJoined_Privos }
