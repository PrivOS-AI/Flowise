import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams, processTemplateVariables } from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { parseConfig, PrivosErrorHandler } from '../utils'
import { SCHEDULE_TYPES, SCHEDULE_TYPE_OPTIONS, SCHEDULE_DEFAULTS, CRON_TEMPLATES } from './constant'

class ScheduleTrigger implements INode {
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
    output?: INodeOutputsValue[]
    triggerType?: string

    constructor() {
        this.label = 'Schedule Trigger'
        this.name = 'scheduleTrigger'
        this.triggerType = 'schedule'
        this.version = 1.0
        this.type = 'triggerProcessor'
        this.category = 'Trigger'
        this.description = 'Flexible schedule trigger supporting intervals, cron, and time-based execution'
        this.icon = 'privos.svg'
        this.color = '#8B5CF6'
        this.baseClasses = [this.type]

        this.inputs = [
            {
                label: 'Enabled',
                name: 'isEnabled',
                type: 'boolean',
                default: true,
                description: 'Enable or disable this trigger'
            },
            {
                label: 'Schedule Type',
                name: 'scheduleType',
                type: 'options',
                options: SCHEDULE_TYPE_OPTIONS,
                default: SCHEDULE_TYPES.INTERVAL,
                description: 'Choose how often to execute'
            },
            {
                label: 'Interval',
                name: 'interval',
                type: 'number',
                default: 5,
                description: 'Time between executions',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.INTERVAL]
                }
            },
            {
                label: 'Unit',
                name: 'intervalUnit',
                type: 'options',
                options: [
                    { label: 'Seconds', name: 'seconds' },
                    { label: 'Minutes', name: 'minutes' },
                    { label: 'Hours', name: 'hours' },
                    { label: 'Days', name: 'days' }
                ],
                default: 'minutes',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.INTERVAL]
                }
            },
            {
                label: 'Cron Pattern',
                name: 'cronPattern',
                type: 'string',
                placeholder: '0 9 * * *',
                description: 'Cron expression (min hour day month dayOfWeek). Use template below or custom',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.CRON]
                }
            },
            {
                label: 'Or Use Template',
                name: 'cronTemplate',
                type: 'options',
                options: CRON_TEMPLATES,
                description: 'Quick select common schedules',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.CRON]
                }
            },
            {
                label: 'Execute At',
                name: 'executeAt',
                type: 'date',
                description: 'When to execute (ISO 8601 format)',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.ONCE]
                }
            },
            {
                label: 'Execution Time',
                name: 'executionTime',
                type: 'array',
                description: 'Select hour and minute',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.DAILY, SCHEDULE_TYPES.WEEKLY, SCHEDULE_TYPES.MONTHLY]
                },
                array: [
                    {
                        label: 'Hour',
                        name: 'hour',
                        type: 'options',
                        options: Array.from({ length: 24 }, (_, i) => ({
                            label: i.toString().padStart(2, '0'),
                            name: i.toString()
                        })),
                        default: new Date().getHours().toString()
                    },
                    {
                        label: 'Minute',
                        name: 'minute',
                        type: 'options',
                        options: Array.from({ length: 60 }, (_, i) => ({
                            label: i.toString().padStart(2, '0'),
                            name: i.toString()
                        })),
                        default: new Date().getMinutes().toString()
                    }
                ]
            },
            {
                label: 'Timezone',
                name: 'timezone',
                type: 'options',
                options: [
                    { label: 'UTC', name: 'UTC' },
                    { label: 'America/New_York', name: 'America/New_York' },
                    { label: 'America/Chicago', name: 'America/Chicago' },
                    { label: 'America/Los_Angeles', name: 'America/Los_Angeles' },
                    { label: 'Europe/London', name: 'Europe/London' },
                    { label: 'Europe/Paris', name: 'Europe/Paris' },
                    { label: 'Europe/Berlin', name: 'Europe/Berlin' },
                    { label: 'Asia/Tokyo', name: 'Asia/Tokyo' },
                    { label: 'Asia/Shanghai', name: 'Asia/Shanghai' },
                    { label: 'Asia/Ho_Chi_Minh', name: 'Asia/Ho_Chi_Minh' },
                    { label: 'Australia/Sydney', name: 'Australia/Sydney' }
                ],
                default: 'UTC',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.DAILY, SCHEDULE_TYPES.WEEKLY, SCHEDULE_TYPES.MONTHLY]
                }
            },
            {
                label: 'Days',
                name: 'weeklyDays',
                type: 'multiOptions',
                options: [
                    { label: 'Monday', name: '1' },
                    { label: 'Tuesday', name: '2' },
                    { label: 'Wednesday', name: '3' },
                    { label: 'Thursday', name: '4' },
                    { label: 'Friday', name: '5' },
                    { label: 'Saturday', name: '6' },
                    { label: 'Sunday', name: '0' }
                ],
                default: ['1'],
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.WEEKLY]
                }
            },
            {
                label: 'Days of Month',
                name: 'monthlyDays',
                type: 'string',
                placeholder: '1, 15, 28',
                description: 'Comma-separated days (1-31)',
                optional: true,
                show: {
                    scheduleType: [SCHEDULE_TYPES.MONTHLY]
                }
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
                name: 'updateFlowState',
                type: 'array',
                description: 'Description of what this trigger does',
                placeholder: 'Enter trigger description...',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'string',
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
                label: 'Execution Time',
                name: 'executionTime',
                description: 'ISO timestamp of execution',
                baseClasses: ['string']
            },
            {
                label: 'Schedule Type',
                name: 'scheduleType',
                description: 'Type of schedule',
                baseClasses: ['string']
            },
            {
                label: 'Schedule Config',
                name: 'scheduleConfig',
                description: 'Full configuration used',
                baseClasses: ['object']
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const inputs = nodeData.inputs || {}
        const isEnabled = (inputs.isEnabled as boolean) ?? true

        if (!isEnabled)
            return {
                id: nodeData.id,
                name: this.name,
                input: nodeData.inputs,
                output: { content: JSON.stringify({ message: 'Trigger is disabled' }, null, 2) }
            }

        let flowState: ICommonObject = {}

        try {
            const config = parseConfig(nodeData)
            const payload = options.triggerData?.form || {}

            // Initialize flow state from payload
            for (const [key, value] of Object.entries(payload)) {
                flowState[key] = value || ''
            }

            // Merge runtime state if it exists
            const runtimeState = options.agentflowRuntime?.state as ICommonObject
            if (runtimeState && Object.keys(runtimeState).length) {
                flowState = { ...runtimeState, ...flowState }
            }

            // Build input/output data
            const inputData: ICommonObject = {}
            const outputData: ICommonObject = {
                executionTime: new Date().toISOString(),
                scheduleType: config.scheduleType,
                scheduleConfig: config
            }

            // Determine input type and prepare data
            if (payload.question && typeof payload.question === 'string') {
                inputData.question = payload.question
                outputData.question = payload.question
            } else if (Object.keys(payload).length > 0) {
                inputData.form = Object.entries(payload)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')
                outputData.form = inputData.form
            }

            // Handle special flags
            if (payload.startEphemeralMemory) outputData.ephemeralMemory = true
            if (payload.startPersistState) outputData.persistState = true

            // Update flow state if configured
            let newState = { ...runtimeState }
            const updateFlowStateConfig = inputs.updateFlowState
            if (Array.isArray(updateFlowStateConfig) && updateFlowStateConfig.length > 0) {
                newState = updateFlowState(runtimeState || {}, updateFlowStateConfig)
            }
            newState = processTemplateVariables(newState, outputData)

            return {
                id: nodeData.id,
                name: this.name,
                input: inputData,
                output: outputData,
                state: newState || flowState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, flowState)
        }
    }
}

module.exports = { nodeClass: ScheduleTrigger }
