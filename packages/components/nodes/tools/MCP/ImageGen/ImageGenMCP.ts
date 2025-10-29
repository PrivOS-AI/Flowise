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
        this.label = 'Image Generation'
        this.name = 'imageGenMCP'
        this.version = 2.0
        this.type = 'ImageGen MCP Tool'
        this.icon = 'image-gen.svg'
        this.category = 'MCP'
        this.description =
            'Unified image generation: Choose Paid API (Google Gemini/Imagen) or Self-Hosted (FLUX, Stable Diffusion on ComfyUI). Returns images directly.'
        this.documentation = 'https://docs.flowiseai.com'
        this.returnDirect = true
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['googleGenerativeAI'],
            optional: true,
            description: 'Required only for Paid API provider'
        }
        this.inputs = [
            {
                label: 'Provider',
                name: 'provider',
                type: 'options',
                options: [
                    {
                        label: 'Paid API (Google)',
                        name: 'google',
                        description: 'Cloud-based, fast, pay-per-use'
                    },
                    {
                        label: 'Self-Hosted (ComfyUI)',
                        name: 'comfyui',
                        description: 'Local models, free, private'
                    }
                ],
                default: 'google',
                description: 'Choose between paid cloud API or self-hosted models'
            },
            {
                label: 'Google Model',
                name: 'googleModel',
                type: 'options',
                options: [
                    {
                        label: 'Gemini 2.0 Flash Preview (FREE)',
                        name: 'gemini-2.0-flash-preview-image-generation',
                        description: 'FREE, good for testing'
                    },
                    {
                        label: 'Gemini 2.5 Flash Image',
                        name: 'gemini-2.5-flash-image',
                        description: 'Latest, fastest, best'
                    },
                    {
                        label: 'Gemini 2.0 Flash Image',
                        name: 'gemini-2.0-flash-image',
                        description: 'Previous version'
                    },
                    {
                        label: 'Imagen 3.0',
                        name: 'imagen-3.0-generate-001',
                        description: 'Previous generation'
                    },
                    {
                        label: 'Imagen 4.0 Fast',
                        name: 'imagen-4.0-fast-generate-001',
                        description: 'Fastest'
                    },
                    {
                        label: 'Imagen 4.0',
                        name: 'imagen-4.0-generate-001',
                        description: 'Balanced'
                    },
                    {
                        label: 'Imagen 4.0 Ultra',
                        name: 'imagen-4.0-ultra-generate-001',
                        description: 'Best quality'
                    }
                ],
                default: 'gemini-2.0-flash-preview-image-generation',
                description: 'Select Google model (Paid API only)',
                show: {
                    provider: ['google']
                }
            },
            {
                label: 'ComfyUI Server URL',
                name: 'comfyuiEndpoint',
                type: 'string',
                default: 'http://localhost:8188',
                placeholder: 'https://your-app.ngrok-free.app',
                description:
                    'Your ComfyUI endpoint. Examples: http://localhost:8188 (local), http://192.168.1.100:8188 (LAN), https://abc123.ngrok-free.app (ngrok)',
                show: {
                    provider: ['comfyui']
                }
            },
            {
                label: 'Self-Hosted Model',
                name: 'selfHostedModel',
                type: 'options',
                options: [
                    {
                        label: 'FLUX Schnell FP8 (Recommended)',
                        name: 'flux1-schnell-fp8.safetensors',
                        description: 'Fast, FREE, Apache 2.0'
                    },
                    {
                        label: 'FLUX Dev FP8',
                        name: 'flux1-dev-fp8.safetensors',
                        description: 'Better quality, need license'
                    },
                    {
                        label: 'SD XL Base',
                        name: 'sd_xl_base_1.0.safetensors',
                        description: 'Classic SD XL, FREE'
                    },
                    {
                        label: 'SD 1.5',
                        name: 'v1-5-pruned-emaonly.safetensors',
                        description: 'Fastest, FREE'
                    },
                    {
                        label: 'Custom Model',
                        name: 'custom',
                        description: 'Enter custom filename below'
                    }
                ],
                default: 'flux1-schnell-fp8.safetensors',
                description: 'Select model (Self-Hosted only)',
                show: {
                    provider: ['comfyui']
                }
            },
            {
                label: 'Custom Model Filename',
                name: 'customModelFilename',
                type: 'string',
                placeholder: 'qwen-vl.safetensors',
                description: 'Enter .safetensors filename (if Custom Model selected)',
                optional: true,
                show: {
                    provider: ['comfyui'],
                    selfHostedModel: ['custom']
                }
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

    async getTools(nodeData: INodeData, _options: ICommonObject): Promise<Tool[]> {
        const provider = (nodeData.inputs?.provider as string) || 'google'

        if (provider === 'google') {
            return this.getGoogleTools(nodeData, _options)
        } else if (provider === 'comfyui') {
            return this.getComfyUITools(nodeData, _options)
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }
    }

    async getGoogleTools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const geminiApiKey = getCredentialParam('googleGenerativeAPIKey', credentialData, nodeData)
        const defaultModel = (nodeData.inputs?.googleModel as string) || 'gemini-2.0-flash-preview-image-generation'

        if (!geminiApiKey) {
            throw new Error('Google AI API key is required for Paid API provider')
        }

        // Path to the compiled MCP server
        const serverPath = path.join(__dirname, 'image-gen-server.mjs')

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                GEMINI_API_KEY: geminiApiKey,
                DEFAULT_MODEL: defaultModel
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, 'stdio')
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Set returnDirect = true for all tools to skip LLM processing
        tools.forEach((tool: any) => {
            tool.returnDirect = true
        })

        return tools as Tool[]
    }

    async getComfyUITools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const comfyuiEndpoint = (nodeData.inputs?.comfyuiEndpoint as string) || 'http://localhost:8188'
        let model = (nodeData.inputs?.selfHostedModel as string) || 'flux1-schnell-fp8.safetensors'

        // If custom model selected, use custom filename
        if (model === 'custom') {
            const customFilename = nodeData.inputs?.customModelFilename as string
            if (customFilename) {
                model = customFilename
            } else {
                throw new Error('Custom model filename is required when using Custom Model option')
            }
        }

        // Path to the ComfyUI MCP server
        const serverPath = path.join(__dirname, 'flux-gen-server.mjs')

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                COMFYUI_ENDPOINT: comfyuiEndpoint,
                MODEL: model,
                // Hardcoded optimal settings (user doesn't configure these)
                IMAGE_SIZE: '480',
                STEPS: '20',
                GUIDANCE: '3.5'
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, 'stdio')
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Set returnDirect = true for all tools to skip LLM processing
        tools.forEach((tool: any) => {
            tool.returnDirect = true
        })

        return tools as Tool[]
    }
}

module.exports = { nodeClass: ImageGen_MCP }
