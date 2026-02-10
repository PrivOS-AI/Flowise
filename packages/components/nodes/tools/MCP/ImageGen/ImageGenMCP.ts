import { Tool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../../src/utils'
import { MCPToolkit } from '../core'
import path from 'path'
import {
    PROVIDERS,
    PROVIDER_LABELS,
    GOOGLE_MODELS,
    COMFYUI_MODELS,
    CREDENTIALS,
    DEFAULTS,
    DOCUMENTATION_URL,
    ERROR_MESSAGES,
    SERVER_FILES,
    ENV_VARS,
    TRANSPORT_TYPE
} from './constants'

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
        this.label = '[PrivOS] Image Generation'
        this.name = 'imageGenMCP'
        this.version = 2.0
        this.type = 'ImageGen MCP Tool'
        this.icon = 'image-gen.svg'
        this.category = 'MCP'
        this.description =
            'Unified image generation: Choose Paid API (Google Gemini/Imagen) or Self-Hosted (FLUX, Stable Diffusion on ComfyUI). Returns images directly.'
        this.documentation = DOCUMENTATION_URL
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: [CREDENTIALS.GOOGLE_GENERATIVE_AI],
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
                        label: PROVIDER_LABELS[PROVIDERS.GOOGLE],
                        name: PROVIDERS.GOOGLE,
                        description: 'Cloud-based, fast, pay-per-use'
                    },
                    {
                        label: PROVIDER_LABELS[PROVIDERS.COMFYUI],
                        name: PROVIDERS.COMFYUI,
                        description: 'Local models, free, private'
                    }
                ],
                default: DEFAULTS.PROVIDER,
                description: 'Choose between paid cloud API or self-hosted models'
            },
            {
                label: 'Google Model',
                name: 'googleModel',
                type: 'options',
                options: [
                    {
                        label: 'Gemini 2.0 Flash Preview (FREE)',
                        name: GOOGLE_MODELS.GEMINI_2_0_FLASH_PREVIEW,
                        description: 'FREE, good for testing'
                    },
                    {
                        label: 'Gemini 2.5 Flash Image',
                        name: GOOGLE_MODELS.GEMINI_2_5_FLASH_IMAGE,
                        description: 'Latest, fastest, best'
                    },
                    {
                        label: 'Gemini 2.0 Flash Image',
                        name: GOOGLE_MODELS.GEMINI_2_0_FLASH_IMAGE,
                        description: 'Previous version'
                    },
                    {
                        label: 'Imagen 3.0',
                        name: GOOGLE_MODELS.IMAGEN_3_0,
                        description: 'Previous generation'
                    },
                    {
                        label: 'Imagen 4.0 Fast',
                        name: GOOGLE_MODELS.IMAGEN_4_0_FAST,
                        description: 'Fastest'
                    },
                    {
                        label: 'Imagen 4.0',
                        name: GOOGLE_MODELS.IMAGEN_4_0,
                        description: 'Balanced'
                    },
                    {
                        label: 'Imagen 4.0 Ultra',
                        name: GOOGLE_MODELS.IMAGEN_4_0_ULTRA,
                        description: 'Best quality'
                    }
                ],
                default: DEFAULTS.GOOGLE_MODEL,
                description: 'Select Google model (Paid API only)',
                show: {
                    provider: [PROVIDERS.GOOGLE]
                }
            },
            {
                label: 'ComfyUI Server URL',
                name: 'comfyuiEndpoint',
                type: 'string',
                default: DEFAULTS.COMFYUI_ENDPOINT,
                placeholder: 'https://your-endpoint.app',
                description: 'Your ComfyUI endpoint. Examples: http://localhost:8188 (local), https://abc123.com',
                show: {
                    provider: [PROVIDERS.COMFYUI]
                }
            },
            {
                label: 'Self-Hosted Model',
                name: 'selfHostedModel',
                type: 'options',
                options: [
                    {
                        label: 'FLUX Schnell FP8',
                        name: COMFYUI_MODELS.FLUX_SCHNELL_FP8,
                        description: 'Fast, FREE, Apache 2.0'
                    },
                    {
                        label: 'FLUX Dev FP8',
                        name: COMFYUI_MODELS.FLUX_DEV_FP8,
                        description: 'Better quality (Currently only this model is available in server )'
                    },
                    {
                        label: 'SD XL Base',
                        name: COMFYUI_MODELS.SD_XL_BASE,
                        description: 'Classic SD XL, FREE'
                    },
                    {
                        label: 'SD 1.5',
                        name: COMFYUI_MODELS.SD_1_5,
                        description: 'Fastest, FREE'
                    },
                    {
                        label: 'Custom Model',
                        name: COMFYUI_MODELS.CUSTOM,
                        description: 'Enter custom filename below'
                    }
                ],
                default: DEFAULTS.COMFYUI_MODEL,
                description: 'Select model (Self-Hosted only)',
                show: {
                    provider: [PROVIDERS.COMFYUI]
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
                    provider: [PROVIDERS.COMFYUI],
                    selfHostedModel: [COMFYUI_MODELS.CUSTOM]
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

        const filteredTools = tools.filter((tool: any) => mcpActions.includes(tool.name))

        // Return tools directly - ComfyUI server now handles storage upload and HTTPS URLs
        return filteredTools
    }

    async getTools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const provider = (nodeData.inputs?.provider as string) || DEFAULTS.PROVIDER

        if (provider === PROVIDERS.GOOGLE) {
            return this.getGoogleTools(nodeData, options)
        } else if (provider === PROVIDERS.COMFYUI) {
            return this.getComfyUITools(nodeData, options)
        } else {
            throw new Error(ERROR_MESSAGES.UNKNOWN_PROVIDER(provider))
        }
    }

    async getGoogleTools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const geminiApiKey = getCredentialParam(CREDENTIALS.GOOGLE_API_KEY_PARAM, credentialData, nodeData)
        const defaultModel = (nodeData.inputs?.googleModel as string) || DEFAULTS.GOOGLE_MODEL

        if (!geminiApiKey) {
            throw new Error(ERROR_MESSAGES.NO_API_KEY)
        }

        // Path to the compiled MCP server
        const serverPath = path.join(__dirname, SERVER_FILES.GOOGLE)

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                [ENV_VARS.GEMINI_API_KEY]: geminiApiKey,
                [ENV_VARS.DEFAULT_MODEL]: defaultModel
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, TRANSPORT_TYPE)
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Return tools directly - they will be processed in init()
        return tools
    }

    async getComfyUITools(nodeData: INodeData, options: ICommonObject): Promise<Tool[]> {
        const comfyuiEndpoint =
            (nodeData.inputs?.comfyuiEndpoint as string) || process.env[ENV_VARS.COMFYUI_ENDPOINT] || DEFAULTS.COMFYUI_ENDPOINT
        let model = (nodeData.inputs?.selfHostedModel as string) || DEFAULTS.COMFYUI_MODEL

        // If custom model selected, use custom filename
        if (model === COMFYUI_MODELS.CUSTOM) {
            const customFilename = nodeData.inputs?.customModelFilename as string
            if (customFilename) {
                model = customFilename
            } else {
                throw new Error(ERROR_MESSAGES.CUSTOM_MODEL_FILENAME_REQUIRED)
            }
        }

        // Path to the ComfyUI MCP server
        const serverPath = path.join(__dirname, SERVER_FILES.COMFYUI)

        // Server parameters for STDIO transport
        const serverParams = {
            command: 'node',
            args: [serverPath],
            env: {
                [ENV_VARS.COMFYUI_ENDPOINT]: comfyuiEndpoint,
                [ENV_VARS.MODEL]: model,
                // Pass storage configuration for direct S3/MinIO upload
                STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
                S3_STORAGE_ACCESS_KEY_ID: process.env.S3_STORAGE_ACCESS_KEY_ID,
                S3_STORAGE_SECRET_ACCESS_KEY: process.env.S3_STORAGE_SECRET_ACCESS_KEY,
                S3_STORAGE_REGION: process.env.S3_STORAGE_REGION,
                S3_STORAGE_BUCKET_NAME: process.env.S3_STORAGE_BUCKET_NAME,
                S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
                S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, TRANSPORT_TYPE)
        await toolkit.initialize()

        const tools = toolkit.tools ?? []

        // Return tools directly - they will be processed in init()
        return tools
    }
}

module.exports = { nodeClass: ImageGen_MCP }
