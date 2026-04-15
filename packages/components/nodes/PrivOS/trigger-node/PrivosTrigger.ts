import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeOutputsValue, INodeParams, processTemplateVariables } from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PrivosEvent } from '../constants'
import { PrivosErrorHandler } from '../utils'

const ALL_EVENTS = [
    // Message events
    { label: 'Message New', name: PrivosEvent.MESSAGE_NEW, description: 'Triggered when a new message is received' },
    { label: 'Message Edited', name: PrivosEvent.MESSAGE_EDITED, description: 'Triggered when a message is edited' },
    { label: 'Message Deleted', name: PrivosEvent.MESSAGE_DELETED, description: 'Triggered when a message is deleted' },
    { label: 'Message Mention', name: PrivosEvent.MESSAGE_MENTION, description: 'Triggered when users are @mentioned in a message' },
    { label: 'Bot Mention', name: PrivosEvent.BOT_MENTION, description: 'Triggered when the bot is @mentioned in a message' },
    // Room events
    { label: 'Room Joined', name: PrivosEvent.ROOM_JOINED, description: 'Triggered when a user joins a room' },
    { label: 'Room Left', name: PrivosEvent.ROOM_LEFT, description: 'Triggered when a user leaves a room' },
    // User events
    { label: 'User Joined', name: PrivosEvent.USER_JOINED, description: 'Triggered when a user joins the workspace' },
    { label: 'User Left', name: PrivosEvent.USER_LEFT, description: 'Triggered when a user leaves the workspace' },
    // List Item events
    { label: 'List Item Created', name: PrivosEvent.LIST_ITEM_CREATED, description: 'Triggered when a new item is created in a list' },
    {
        label: 'List Item Stage Changed',
        name: PrivosEvent.LIST_ITEM_STAGE_CHANGED,
        description: 'Triggered when an item is moved to a different stage'
    },
    {
        label: 'List Item Attributes Changed',
        name: PrivosEvent.LIST_ITEM_ATTRIBUTES_CHANGED,
        description: 'Triggered when item attributes/fields are updated'
    },
    // File events
    { label: 'File Created', name: PrivosEvent.FILE_CREATED, description: 'Triggered when a file is uploaded' },
    { label: 'File Updated', name: PrivosEvent.FILE_UPDATED, description: 'Triggered when a file is updated or renamed' },
    { label: 'File Deleted', name: PrivosEvent.FILE_DELETED, description: 'Triggered when a file is deleted' },
    // Folder events
    { label: 'Folder Created', name: PrivosEvent.FOLDER_CREATED, description: 'Triggered when a folder is created' },
    { label: 'Folder Deleted', name: PrivosEvent.FOLDER_DELETED, description: 'Triggered when a folder is deleted' },
    { label: 'Folder Renamed', name: PrivosEvent.FOLDER_RENAMED, description: 'Triggered when a folder is renamed' }
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
    triggerType?: string

    constructor() {
        this.label = 'PrivOS Trigger'
        this.name = 'privosTrigger'
        this.triggerType = 'privos'
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
                label: 'Retry on Fail',
                name: 'retryOnFail',
                type: 'boolean',
                default: false,
                description: 'Enable retry mechanism when trigger execution fails'
            },
            {
                label: 'Max Tries',
                name: 'attempts',
                type: 'number',
                default: 3,
                description: 'Maximum number of retry attempts',
                optional: true,
                show: {
                    retryOnFail: true
                }
            },
            {
                label: 'Retry Delay',
                name: 'type',
                type: 'options',
                options: [
                    {
                        label: 'Fixed',
                        name: 'fixed',
                        description: 'Use a fixed delay between retry attempts'
                    },
                    {
                        label: 'Exponential',
                        name: 'exponential',
                        description: 'Delay increases exponentially with each retry (wait * 2^attempt)'
                    }
                ],
                default: 'fixed',
                optional: true,
                show: {
                    retryOnFail: true
                }
            },
            {
                label: 'Wait Between Tries (ms)',
                name: 'backoff',
                type: 'number',
                default: 3000,
                description: 'Wait time in milliseconds between retry attempts',
                optional: true,
                show: {
                    retryOnFail: true
                }
            },
            {
                label: 'Description',
                name: 'description',
                type: 'string',
                rows: 2,
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
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const triggerData = options.triggerData || {}
        const form = triggerData.form || {}

        // Merge event-specific data into payload so it flows through as form input
        const eventData: ICommonObject = {}
        if (triggerData.eventType) eventData.eventType = triggerData.eventType
        if (triggerData.bot) eventData.bot = triggerData.bot
        if (triggerData.timestamp) eventData.timestamp = triggerData.timestamp
        if (triggerData.room) eventData.room = triggerData.room
        if (triggerData.roomId) eventData.roomId = triggerData.roomId
        if (triggerData.message) eventData.message = triggerData.message
        if (triggerData.messageId) eventData.messageId = triggerData.messageId
        if (triggerData.item) eventData.item = triggerData.item
        if (triggerData.list) eventData.list = triggerData.list
        if (triggerData.stage) eventData.stage = triggerData.stage
        if (triggerData.newStage) eventData.newStage = triggerData.newStage
        if (triggerData.previousStage) eventData.previousStage = triggerData.previousStage
        if (triggerData.actor) eventData.actor = triggerData.actor
        if (triggerData.changedFields) eventData.changedFields = triggerData.changedFields
        if (triggerData.file) eventData.file = triggerData.file
        if (triggerData.changes) eventData.changes = triggerData.changes
        if (triggerData.folder) eventData.folder = triggerData.folder
        if (triggerData.previousName) eventData.previousName = triggerData.previousName

        const payload = { ...form, ...eventData }
        const _flowState = Object.keys(payload).map((key) => ({ key, value: payload[key] || '' }))
        const startInputType = payload?.question && typeof payload.question === 'string' ? 'chatInput' : 'formInput'
        const startEphemeralMemory = payload?.startEphemeralMemory as boolean
        const startPersistState = payload?.startPersistState as boolean
        const input = Object.entries(payload)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')

        // trigger inputs
        const isEnabled = (nodeData.inputs?.isEnabled as boolean) ?? true
        const updateFLowState = nodeData.inputs?.updateFLowState
        // Check if trigger is enabled
        if (!isEnabled)
            return {
                id: nodeData.id,
                name: this.name,
                input: nodeData.inputs,
                output: { content: JSON.stringify({ message: 'Trigger is disabled' }, null, 2) }
            }

        if (!nodeData.credential) throw new Error('Credential not found')
        let flowState: Record<string, any> = {}

        try {
            for (const state of _flowState) {
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

            if (startEphemeralMemory) outputData.ephemeralMemory = true
            if (startPersistState) outputData.persistState = true

            // Update flow state if needed
            let newState = { ...runtimeState }
            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(runtimeState, updateFLowState)
            }
            newState = processTemplateVariables(newState, outputData)

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
