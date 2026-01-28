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
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PrivosEvent } from '../constants'
import { PrivosErrorHandler } from '../utils'

const ALL_EVENTS = [
    { label: 'Message New', name: PrivosEvent.MESSAGE_NEW, description: 'Triggered when a new message is received' },
    { label: 'Message Edited', name: PrivosEvent.MESSAGE_EDITED, description: 'Triggered when a message is edited' },
    { label: 'Message Deleted', name: PrivosEvent.MESSAGE_DELETED, description: 'Triggered when a message is deleted' },
    { label: 'Room Joined', name: PrivosEvent.ROOM_JOINED, description: 'Triggered when a user joins a room' },
    { label: 'Room Left', name: PrivosEvent.ROOM_LEFT, description: 'Triggered when a user leaves a room' },
    { label: 'User Joined', name: PrivosEvent.USER_JOINED, description: 'Triggered when a user joins the workspace' },
    { label: 'User Left', name: PrivosEvent.USER_LEFT, description: 'Triggered when a user leaves the workspace' },
]

class PrivosTrigger implements INode {
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
        this.label = 'PrivOS Trigger'
        this.name = 'privosTrigger'
        this.version = 1.0
        this.type = 'triggerProcessor'
        this.category = 'Trigger'
        this.description = 'PrivOS trigger node with configurable events and webhook URL'
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
                label: 'Enabled',
                name: 'isEnabled',
                type: 'boolean',
                default: true,
                description: 'Enable or disable this trigger'
            },
            {
                label: 'Events',
                name: 'events',
                type: 'multiOptions',
                options: ALL_EVENTS
            },
            {
                label: 'Description',
                name: 'description',
                type: 'string',
                rows: 3,
                description: 'Description of what this trigger does',
                placeholder: 'Enter trigger description...',
                optional: true
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
    }

    //@ts-ignore
    loadMethods = {
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        },
        listEvents(_: INodeData, options: ICommonObject): INodeOptionsValue[] {
            return ALL_EVENTS
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const payload = options.triggerData?.form || {}
        const _flowState = Object.keys(payload).map((key) => ({ key, value: payload[key] || '' }))
        const startInputType = payload?.question && typeof payload.question === 'string' ? 'chatInput' : 'formInput'
        const startEphemeralMemory = payload?.startEphemeralMemory as boolean
        const startPersistState = payload?.startPersistState as boolean
        const input = Object.entries(payload).map(([key, value]) => `${key}: ${value}`).join('\n')

        const isEnabled = (nodeData.inputs?.isEnabled as boolean) ?? true
        // Check if trigger is enabled
        if (!isEnabled) {
            return {
                id: nodeData.id,
                name: this.name,
                input: nodeData.inputs,
                output: { content: JSON.stringify({ message: 'Trigger is disabled' }, null, 2) },
            }
        }

        if (!nodeData.credential) { throw new Error('Credential not found') }
        let flowState: Record<string, any> = {}

        try {
            let flowStateArray = []
            if (_flowState) {
                try {
                    flowStateArray = typeof _flowState === 'string' ? JSON.parse(_flowState) : _flowState
                } catch (error) {
                    throw new Error('Invalid Flow State')
                }
            }

            for (const state of flowStateArray) {
                flowState[state.key] = state.value
            }

            const runtimeState = options.agentflowRuntime?.state as ICommonObject
            if (startPersistState === true && runtimeState && Object.keys(runtimeState).length) {
                for (const state in runtimeState) {
                    flowState[state] = runtimeState[state]
                }
            }

            const inputData: ICommonObject = {}
            const outputData: ICommonObject = {}

            if (startInputType === 'chatInput') {
                inputData.question = payload.question
                outputData.question = payload.question
            }

            if (startInputType === 'formInput') {
                inputData.form = {
                    title: '',
                    description: '',
                    inputs: Object.keys(payload).map((key) => ({ label: key, name: key, type: typeof payload[key], addOptions: '' }))
                }

                let form = input
                if (options.agentflowRuntime?.form && Object.keys(options.agentflowRuntime.form).length) {
                    form = options.agentflowRuntime.form
                }
                outputData.form = form
            }

            if (startEphemeralMemory) {
                outputData.ephemeralMemory = true
            }

            if (startPersistState) {
                outputData.persistState = true
            }

            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: inputData,
                output: outputData,
                state: flowState
            }

            return returnOutput
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, flowState)
        }
    }
}

module.exports = { nodeClass: PrivosTrigger }
