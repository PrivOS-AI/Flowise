import { Tool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../../src/utils'
import { MCPToolkit } from '../core'
import path from 'path'
import { addSingleFileToStorage } from '../../../../src/storageUtils'
import { randomBytes } from 'crypto'
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
    TRANSPORT_TYPE,
    BASE_CLASS
} from './constants'

/**
 * Post-process tool response to extract base64 images, save to storage, and replace with public URLs
 */
async function postProcessImageResponse(toolResponse: string, options: ICommonObject): Promise<string> {
    const chatflowId = options.chatflowid
    const chatId = options.chatId
    const orgId = options.orgId || 'default'
    const baseURL = options.baseURL || ''

    if (!chatflowId || !chatId) {
        console.warn('[ImageGenMCP] Missing chatflowId or chatId, returning base64 images as-is')
        return toolResponse
    }

    // Regex to match markdown images with base64 data URLs
    // Matches: ![alt text](data:image/jpeg;base64,...)
    const base64ImageRegex = /!\[([^\]]*)\]\(data:image\/(png|jpeg|jpg|gif|webp);base64,([^)]+)\)/g

    let processedResponse = toolResponse
    const matches = Array.from(toolResponse.matchAll(base64ImageRegex))

    for (const match of matches) {
        const fullMatch = match[0] // Full markdown image string
        const altText = match[1] || 'Generated image'
        const imageType = match[2] // png, jpeg, etc.
        const base64Data = match[3]

        try {
            // Convert base64 to buffer
            const imageBuffer = Buffer.from(base64Data, 'base64')

            // Generate unique filename
            const timestamp = Date.now()
            const randomSuffix = randomBytes(4).toString('hex')
            const fileName = `image-gen-${timestamp}-${randomSuffix}.${imageType}`

            // Save to storage using Flowise storage system
            // Path: storage/{orgId}/{chatflowId}/{chatId}/{fileName}
            const mimeType = `image/${imageType}`
            await addSingleFileToStorage(mimeType, imageBuffer, fileName, orgId, chatflowId, chatId)

            // Generate public URL for the image
            const publicURL = `${baseURL}/api/v1/get-upload-file?chatflowId=${chatflowId}&chatId=${chatId}&fileName=${fileName}`

            // Replace base64 data URL with public URL in markdown
            const newMarkdown = `![${altText}](${publicURL})`
            processedResponse = processedResponse.replace(fullMatch, newMarkdown)

            console.log(`[ImageGenMCP] Saved image to storage: ${fileName}`)
            console.log(`[ImageGenMCP] Generated public URL: ${publicURL}`)
            console.log(`[ImageGenMCP] Context - chatflowId: ${chatflowId}, chatId: ${chatId}, orgId: ${orgId}, baseURL: ${baseURL}`)
        } catch (error) {
            console.error('[ImageGenMCP] Error saving image to storage:', error)
            // Keep original base64 on error
        }
    }

    return processedResponse
}

/**
 * Wrap a tool to post-process its response
 */
function wrapToolWithStorageProcessing(tool: Tool, options: ICommonObject): Tool {
    // Store the original invoke method
    const originalInvoke = tool.invoke.bind(tool)

    // Override invoke to post-process the response
    tool.invoke = async function (input: any, config?: any): Promise<string> {
        const result = await originalInvoke(input, config)

        // Post-process if result contains base64 images
        if (typeof result === 'string' && result.includes('data:image')) {
            return await postProcessImageResponse(result, options)
        }

        return result
    }

    return tool
}

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
        this.returnDirect = true
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
                placeholder: 'https://your-app.ngrok-free.app',
                description:
                    'Your ComfyUI endpoint. Examples: http://localhost:8188 (local), http://192.168.1.100:8188 (LAN), https://abc123.ngrok-free.app (ngrok)',
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

        const filteredTools = tools.filter((tool: any) => mcpActions.includes(tool.name))

        // Wrap each tool to post-process responses and save images to storage
        const wrappedTools = filteredTools.map((tool: Tool) => wrapToolWithStorageProcessing(tool, options))

        return wrappedTools
    }

    async getTools(nodeData: INodeData, _options: ICommonObject): Promise<Tool[]> {
        const provider = (nodeData.inputs?.provider as string) || DEFAULTS.PROVIDER

        if (provider === PROVIDERS.GOOGLE) {
            return this.getGoogleTools(nodeData, _options)
        } else if (provider === PROVIDERS.COMFYUI) {
            return this.getComfyUITools(nodeData, _options)
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

        // Set returnDirect = true for all tools to skip LLM processing
        tools.forEach((tool: any) => {
            tool.returnDirect = true
        })

        return tools as Tool[]
    }

    async getComfyUITools(nodeData: INodeData, _options: ICommonObject): Promise<Tool[]> {
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
                // Hardcoded optimal settings (user doesn't configure these)
                [ENV_VARS.IMAGE_SIZE]: DEFAULTS.IMAGE_SIZE,
                [ENV_VARS.STEPS]: DEFAULTS.STEPS,
                [ENV_VARS.GUIDANCE]: DEFAULTS.GUIDANCE
            }
        }

        // Create MCPToolkit with STDIO transport
        const toolkit = new MCPToolkit(serverParams, TRANSPORT_TYPE)
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
