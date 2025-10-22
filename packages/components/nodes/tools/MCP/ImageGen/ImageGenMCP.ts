import { Tool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../../src/utils'
import { MCPToolkit } from '../core'
import path from 'path'

class ImageGen_MCP implements INode {
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
        this.label = '[PrivOS] Image Generation MCP'
        this.name = 'imageGenMCP'
        this.version = 1.0
        this.type = 'ImageGen MCP Tool'
        this.icon = 'image-gen.svg'
        this.category = 'MCP'
        this.description =
            'MCP server for image generation using Google Gemini/Imagen models. Returns images directly without LLM processing.'
        this.documentation = 'https://ai.google.dev/gemini-api/docs'
        this.returnDirect = true
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['googleGenerativeAI']
        }
        this.inputs = [
            {
                label: 'Default Model',
                name: 'defaultModel',
                type: 'options',
                options: [
                    {
                        label: 'Gemini 2.0 Flash Preview Image (FREE, Recommended)',
                        name: 'gemini-2.0-flash-preview-image-generation',
                        description: 'Preview model, FREE, good for testing'
                    },
                    {
                        label: 'Gemini 2.5 Flash Image',
                        name: 'gemini-2.5-flash-image',
                        description: 'Latest, fastest, best quality, Paid'
                    },
                    {
                        label: 'Gemini 2.0 Flash Image (Paid)',
                        name: 'gemini-2.0-flash-image',
                        description: 'Previous version, Paid'
                    },
                    {
                        label: 'Imagen 3.0 Generate (Paid)',
                        name: 'imagen-3.0-generate-001',
                        description: 'Previous generation Imagen model'
                    },
                    {
                        label: 'Imagen 4.0 Fast (Paid)',
                        name: 'imagen-4.0-fast-generate-001',
                        description: 'Fastest generation, good quality'
                    },
                    {
                        label: 'Imagen 4.0 Generate (Paid)',
                        name: 'imagen-4.0-generate-001',
                        description: 'Balanced speed and quality'
                    },
                    {
                        label: 'Imagen 4.0 Ultra (Paid)',
                        name: 'imagen-4.0-ultra-generate-001',
                        description: 'Best quality, slowest'
                    }
                ],
                default: 'gemini-2.0-flash-preview-image-generation',
                description: 'Select default image generation model'
            },
            {
                label: 'Available Actions',
                name: 'mcpActions',
                type: 'asyncMultiOptions',
                loadMethod: 'listActions',
                refresh: true
            }
        ]
        this.baseClasses = ['Tool']
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
                        description: 'No available actions, please check your Google AI API key and refresh'
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
        const geminiApiKey = getCredentialParam('googleGenerativeAPIKey', credentialData, nodeData)
        const defaultModel = (nodeData.inputs?.defaultModel as string) || 'gemini-2.0-flash-preview-image-generation'

        if (!geminiApiKey) {
            throw new Error('No Google AI API key provided')
        }

        // Path to the compiled MCP server
        const serverPath = path.join(__dirname, 'image-gen-server.js')

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                GEMINI_API_KEY: geminiApiKey,
                DEFAULT_MODEL: defaultModel // Pass default model to server
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, 'stdio')
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Set returnDirect = true for all tools to skip LLM processing
        // This ensures images are displayed directly without Agent LLM interference
        tools.forEach((tool: any) => {
            tool.returnDirect = true
        })

        return tools as Tool[]
    }
}

module.exports = { nodeClass: ImageGen_MCP }
