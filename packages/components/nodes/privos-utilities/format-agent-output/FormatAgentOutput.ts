import { ICommonObject, INode, INodeData, INodeOutputsValue, INodeParams } from '../../../src/Interface'
import { PrivosErrorHandler } from '../../PrivOS/utils'

interface IPrivosResponse {
    message: string
    document: string
    isModify: boolean
}

class FormatAgentOutput_PrivosUtilities implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    inputs: INodeParams[]
    outputs: INodeOutputsValue[]
    baseClasses: string[]

    constructor() {
        this.label = 'Format Agent Output'
        this.name = 'formatAgentOutput'
        this.version = 1.0
        this.type = 'ResponseFormatter'
        this.category = 'Privos-Utilities'
        // this.category = 'Agent Flows'
        this.description = 'Convert agent output to structured JSON string'
        this.icon = 'privos.svg'
        this.baseClasses = [this.type]
        this.color = '#6c757d'
        this.inputs = [
            {
                label: 'Agent Output',
                name: 'agentOutput',
                type: 'string',
                description: 'Raw output from previous agent or node',
                acceptVariable: true,
                optional: true,
                acceptNodeOutputAsVariable: true
            },
            {
                label: 'Message',
                name: 'message',
                type: 'string',
                acceptVariable: true,
                default: 'Success',
                optional: true
            },
            {
                label: 'Is Modify?',
                name: 'isModify',
                type: 'boolean',
                default: false
            }
        ]
    }

    /**
     * Parse đa dạng các kiểu dữ liệu đầu vào thành chuỗi văn bản thuần túy.
     */
    private parseContent(input: any): string {
        if (!input) return ''
        if (typeof input === 'string') return input

        // Trường hợp đầu vào là object kết quả từ một Agent Node khác
        if (typeof input === 'object') {
            return input.output?.content ?? JSON.stringify(input, null, 2)
        }

        return String(input)
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { agentOutput, isModify } = nodeData.inputs as ICommonObject
        const state = options.agentflowRuntime?.state

        try {
            const parsedMessage = this.parseContent(agentOutput)

            const result: IPrivosResponse = {
                message: parsedMessage,
                document: '',
                isModify: !!isModify
            }

            return {
                jsonString: JSON.stringify(result, null, 2),
                id: nodeData.id,
                name: this.name,
                state,
                input: { agentOutput: parsedMessage, isModify },
                output: { content: JSON.stringify(result, null, 2) }
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }
}

module.exports = { nodeClass: FormatAgentOutput_PrivosUtilities }
