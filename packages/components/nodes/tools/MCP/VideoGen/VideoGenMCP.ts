import { Tool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../../src/utils'
import { MCPToolkit } from '../core'
import path from 'path'
import {
    VIDEO_MODELS,
    CREDENTIALS,
    DEFAULTS,
    DOCUMENTATION_URL,
    ERROR_MESSAGES,
    SERVER_FILES,
    ENV_VARS,
    TRANSPORT_TYPE,
    BASE_CLASS
} from './constants'

class VideoGen_MCP implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    documentation: string
    inputs: INodeParams[]
    returnDirect: boolean

    constructor() {
        this.label = 'Video Generation'
        this.name = 'videoGenMCP'
        this.version = 1.0
        this.type = 'VideoGen MCP Tool'
        this.icon = 'video-player.svg'
        this.category = 'MCP'
        this.description =
            'MCP server for video generation using Google Veo 2.0. Generates high-quality videos from text or images. Returns video URLs directly without LLM processing.'
        this.documentation = DOCUMENTATION_URL
        this.returnDirect = true
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: [CREDENTIALS.GOOGLE_GENERATIVE_AI]
        }
        this.inputs = [
            {
                label: 'Default Model',
                name: 'defaultModel',
                type: 'options',
                options: [
                    {
                        label: 'Veo 2.0 Generate (Recommended)',
                        name: VIDEO_MODELS.VEO_2_0,
                        description: 'Latest Veo model, high-quality video generation up to 10 seconds'
                    }
                ],
                default: DEFAULTS.MODEL,
                description: 'Select default video generation model'
            },
            {
                label: 'Available Actions',
                name: 'mcpActions',
                type: 'asyncMultiOptions',
                loadMethod: 'listActions',
                refresh: true
            }
        ]
        this.baseClasses = [BASE_CLASS]
    }

    //@ts-ignore
    loadMethods = {
        listActions: async (nodeData: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> => {
            try {
                const toolset = await this.getTools(nodeData, options)
                toolset.sort((a: any, b: any) => a.name.localeCompare(b.name))

                return toolset.map(({ name, ...rest }) => ({
                    label: name.toUpperCase().replace(/_/g, ' '),
                    name: name,
                    description: rest.description || name
                }))
            } catch (error) {
                console.error('Error listing actions:', error)
                return [
                    {
                        label: 'No Available Actions',
                        name: 'error',
                        description: ERROR_MESSAGES.NO_ACTIONS
                    }
                ]
            }
        }
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const tools = await this.getTools(nodeData, options)

        const _mcpActions = nodeData.inputs?.mcpActions
        let mcpActions = []
        if (_mcpActions) {
            try {
                mcpActions = typeof _mcpActions === 'string' ? JSON.parse(_mcpActions) : _mcpActions
            } catch (error) {
                console.error('Error parsing mcp actions:', error)
            }
        }

        return tools.filter((tool: any) => mcpActions.includes(tool.name))
    }

    async getTools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const geminiApiKey = getCredentialParam(CREDENTIALS.GOOGLE_API_KEY_PARAM, credentialData, nodeData)
        const defaultModel = (nodeData.inputs?.defaultModel as string) || DEFAULTS.MODEL

        if (!geminiApiKey) {
            throw new Error(ERROR_MESSAGES.NO_API_KEY)
        }

        // Path to the compiled MCP server
        const serverPath = path.join(__dirname, SERVER_FILES.VIDEOGEN)

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                [ENV_VARS.GEMINI_API_KEY]: geminiApiKey,
                [ENV_VARS.DEFAULT_MODEL]: defaultModel // Pass default model to server
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, TRANSPORT_TYPE)
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Set returnDirect = true for all tools to skip LLM processing
        // This ensures video URLs are displayed directly without Agent LLM interference
        tools.forEach((tool: any) => {
            tool.returnDirect = true
        })

        return tools as Tool[]
    }
}

module.exports = { nodeClass: VideoGen_MCP }
