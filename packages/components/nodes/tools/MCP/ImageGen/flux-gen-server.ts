import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
import axios from 'axios'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get configuration from environment variables (set by Flowise)
const COMFYUI_ENDPOINT = process.env.COMFYUI_ENDPOINT || 'http://localhost:8188'
const MODEL = process.env.MODEL || 'flux1.safetensors'
const IMAGE_SIZE = parseInt(process.env.IMAGE_SIZE || '480')
const STEPS = parseInt(process.env.STEPS || '20')
const GUIDANCE = parseFloat(process.env.GUIDANCE || '3.5')

// Optional authentication
const COMFYUI_AUTH_USER = process.env.COMFYUI_AUTH_USER
const COMFYUI_AUTH_PASSWORD = process.env.COMFYUI_AUTH_PASSWORD
const COMFYUI_API_KEY = process.env.COMFYUI_API_KEY

// Detect model type from filename
function detectModelType(modelFilename: string): string {
    const lower = modelFilename.toLowerCase()

    if (lower.includes('flux')) {
        return 'flux'
    } else if (lower.includes('sd_xl') || lower.includes('sdxl')) {
        return 'sdxl'
    } else if (lower.includes('v1-5') || lower.includes('sd-v1-5') || lower.includes('sd15')) {
        return 'sd15'
    } else {
        // Custom/unknown model - use generic template
        return 'custom'
    }
}

const MODEL_TYPE = detectModelType(MODEL)

console.error(`[ComfyUI MCP Server] ==========================================`)
console.error(`[ComfyUI MCP Server] ComfyUI Endpoint: ${COMFYUI_ENDPOINT}`)
console.error(`[ComfyUI MCP Server] Model: ${MODEL}`)
console.error(`[ComfyUI MCP Server] Model Type: ${MODEL_TYPE}`)
console.error(`[ComfyUI MCP Server] Image Size: ${IMAGE_SIZE}x${IMAGE_SIZE}`)
console.error(`[ComfyUI MCP Server] Steps: ${STEPS}, Guidance: ${GUIDANCE}`)
console.error(`[ComfyUI MCP Server] Auth: ${COMFYUI_AUTH_USER ? 'Basic Auth' : COMFYUI_API_KEY ? 'API Key' : 'None'}`)
console.error(`[ComfyUI MCP Server] ==========================================`)

/**
 * Get axios config with authentication if provided
 */
function getAxiosConfig(): any {
    const config: any = {}

    // Basic auth (username:password)
    if (COMFYUI_AUTH_USER && COMFYUI_AUTH_PASSWORD) {
        config.auth = {
            username: COMFYUI_AUTH_USER,
            password: COMFYUI_AUTH_PASSWORD
        }
    }

    // API Key (Bearer token)
    if (COMFYUI_API_KEY) {
        config.headers = {
            Authorization: `Bearer ${COMFYUI_API_KEY}`
        }
    }

    return config
}

/**
 * Compress image for display in chat UI
 */
async function compressImageForDisplay(imageBuffer: Buffer): Promise<string> {
    try {
        const compressedBuffer = await sharp(imageBuffer)
            .resize(800, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: 60,
                progressive: true
            })
            .toBuffer()

        return compressedBuffer.toString('base64')
    } catch (error) {
        console.error('[ComfyUI MCP Server] Error compressing image:', error)
        return imageBuffer.toString('base64')
    }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Define available tools
const TOOLS: Tool[] = [
    {
        name: 'generate_image',
        description: 'Generate an image from a text prompt using self-hosted FLUX/Stable Diffusion models on ComfyUI. Free and private.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Detailed description of the image you want to generate'
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid in the image (e.g., "blurry, low quality, distorted")'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'generate_multiple_images',
        description: 'Generate multiple image variations from a single prompt using self-hosted models.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Detailed description of the image'
                },
                count: {
                    type: 'number',
                    description: 'Number of variations (1-4)',
                    minimum: 1,
                    maximum: 4,
                    default: 2
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid'
                }
            },
            required: ['prompt']
        }
    }
]

// Create MCP server
const server = new Server(
    {
        name: 'comfyui-image-generation-server',
        version: '1.0.0'
    },
    {
        capabilities: {
            tools: {}
        }
    }
)

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: TOOLS
    }
})

// Handle tools/call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
        if (name === 'generate_image') {
            return await generateImage(args)
        } else if (name === 'generate_multiple_images') {
            return await generateMultipleImages(args)
        } else {
            throw new Error(`Unknown tool: ${name}`)
        }
    } catch (error: any) {
        console.error('[ComfyUI MCP Server] Error:', error.message)
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}\n\nMake sure ComfyUI is running at ${COMFYUI_ENDPOINT} and model ${MODEL} is installed.`
                }
            ],
            isError: true
        }
    }
})

/**
 * Load workflow template from JSON file
 */
function loadWorkflowTemplate(modelType: string): any {
    const templatePath = path.join(__dirname, 'workflows', `${modelType}.json`)

    console.error(`[ComfyUI MCP Server] Loading workflow template: ${templatePath}`)

    if (!fs.existsSync(templatePath)) {
        console.error(`[ComfyUI MCP Server] Template not found, falling back to flux.json`)
        const fallbackPath = path.join(__dirname, 'workflows', 'flux.json')
        if (fs.existsSync(fallbackPath)) {
            return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'))
        } else {
            throw new Error(`Workflow template not found: ${templatePath}`)
        }
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8')
    return JSON.parse(templateContent)
}

/**
 * Build ComfyUI workflow from template
 * Injects prompt, model, and parameters into the template
 */
function buildWorkflowFromTemplate(prompt: string, negativePrompt: string, seed?: number): any {
    // Load template based on model type (always API format now)
    const template = loadWorkflowTemplate(MODEL_TYPE)

    // Deep clone template
    const workflow = JSON.parse(JSON.stringify(template))

    // Inject values into workflow nodes
    Object.keys(workflow).forEach((nodeId) => {
        const node = workflow[nodeId]

        if (node.class_type === 'CheckpointLoaderSimple') {
            // Don't override - use model from workflow template
            // (because user's ComfyUI may have different models available)
            // node.inputs.ckpt_name = MODEL
            console.error(`[ComfyUI MCP Server] Using model from template: ${node.inputs.ckpt_name}`)
        } else if (node.class_type === 'UNetLoader') {
            // For FLUX with separate UNet
            node.inputs.unet_name = MODEL
        } else if (node.class_type === 'CLIPTextEncode') {
            // Detect positive/negative prompt by checking existing text or node ID
            const existingText = node.inputs?.text || ''

            // Node 6 is typically positive, node 7 is negative
            // Also check if text field has content (positive) or empty (negative)
            if (nodeId === '6' || existingText.length > 10) {
                node.inputs.text = prompt
            } else if (nodeId === '7' || existingText.length === 0) {
                node.inputs.text = negativePrompt || ''
            }
        } else if (node.class_type === 'EmptySD3LatentImage' || node.class_type === 'EmptyLatentImage') {
            // Inject image dimensions
            node.inputs.width = IMAGE_SIZE
            node.inputs.height = IMAGE_SIZE
            node.inputs.batch_size = 1
        } else if (node.class_type === 'FluxGuidance') {
            // Inject guidance scale
            node.inputs.guidance = GUIDANCE
        } else if (node.class_type === 'KSampler') {
            // Inject sampling parameters
            node.inputs.seed = seed || Math.floor(Math.random() * 1000000000)
            node.inputs.steps = STEPS
            // Keep existing sampler_name, scheduler, denoise, cfg from template
        }
    })

    return workflow
}

/**
 * Queue workflow in ComfyUI and wait for completion
 */
async function queueAndWaitForImage(workflow: any): Promise<Buffer> {
    console.error('[ComfyUI MCP Server] Queuing workflow to ComfyUI...')

    // Queue the prompt with authentication
    const queueResponse = await axios.post(
        `${COMFYUI_ENDPOINT}/prompt`,
        {
            prompt: workflow,
            client_id: 'flowise-mcp'
        },
        getAxiosConfig()
    )

    const promptId = queueResponse.data.prompt_id
    console.error(`[ComfyUI MCP Server] Prompt queued with ID: ${promptId}`)

    // Poll for completion
    console.error('[ComfyUI MCP Server] Waiting for image generation...')
    let attempts = 0
    const maxAttempts = 120 // 2 minutes max (2s * 120 = 240s)

    while (attempts < maxAttempts) {
        await sleep(2000) // Check every 2 seconds
        attempts++

        try {
            const historyResponse = await axios.get(`${COMFYUI_ENDPOINT}/history/${promptId}`, getAxiosConfig())
            const history = historyResponse.data[promptId]

            if (history && history.status && history.status.completed) {
                console.error('[ComfyUI MCP Server] Generation completed!')

                // Get output image filename - find SaveImage node dynamically
                const outputs = history.outputs

                // Find SaveImage node (usually node 9, but can vary)
                let saveImageNode = null
                let saveImageNodeId = null

                for (const [nodeId, output] of Object.entries(outputs)) {
                    if (output && (output as any).images && (output as any).images.length > 0) {
                        saveImageNode = output
                        saveImageNodeId = nodeId
                        break
                    }
                }

                if (!saveImageNode || !(saveImageNode as any).images || (saveImageNode as any).images.length === 0) {
                    throw new Error('No images in output')
                }

                const imageInfo = (saveImageNode as any).images[0]
                const filename = imageInfo.filename
                const subfolder = imageInfo.subfolder || ''

                console.error(`[ComfyUI MCP Server] Image from node ${saveImageNodeId}: ${filename}`)

                // Download image with authentication
                const viewUrl = `${COMFYUI_ENDPOINT}/view`
                const imageResponse = await axios.get(viewUrl, {
                    ...getAxiosConfig(),
                    params: {
                        filename: filename,
                        subfolder: subfolder,
                        type: 'output'
                    },
                    responseType: 'arraybuffer'
                })

                return Buffer.from(imageResponse.data)
            }
        } catch (error: any) {
            // Continue polling
            if (attempts % 10 === 0) {
                console.error(`[ComfyUI MCP Server] Still waiting... (${attempts * 2}s elapsed)`)
            }
        }
    }

    throw new Error('Timeout waiting for image generation. ComfyUI may be overloaded or the model is too large.')
}

/**
 * Generate a single image
 */
async function generateImage(args: any) {
    const prompt = args.prompt as string
    const negativePrompt = args.negative_prompt as string | undefined

    console.error(`[ComfyUI MCP Server] ==========================================`)
    console.error(`[ComfyUI MCP Server] Generating image...`)
    console.error(`[ComfyUI MCP Server] Prompt: ${prompt}`)
    if (negativePrompt) {
        console.error(`[ComfyUI MCP Server] Negative: ${negativePrompt}`)
    }
    console.error(`[ComfyUI MCP Server] ==========================================`)

    // Build workflow from template
    const workflow = buildWorkflowFromTemplate(prompt, negativePrompt || '')

    // Queue and wait for image
    const imageBuffer = await queueAndWaitForImage(workflow)

    console.error(`[ComfyUI MCP Server] Image received, size: ${(imageBuffer.length / 1024).toFixed(2)} KB`)

    // Compress for display
    console.error(`[ComfyUI MCP Server] Compressing image...`)
    const compressedBase64 = await compressImageForDisplay(imageBuffer)
    const compressedSize = (Math.round(compressedBase64.length * 0.75) / 1024).toFixed(2)
    console.error(`[ComfyUI MCP Server] Compressed to ~${compressedSize} KB`)

    const dataUrl = `data:image/jpeg;base64,${compressedBase64}`

    return {
        content: [
            {
                type: 'text',
                text: `Image generated successfully using ${MODEL}!\n![Generated Image](${dataUrl})`
            }
        ]
    }
}

/**
 * Generate multiple images
 */
async function generateMultipleImages(args: any) {
    const prompt = args.prompt as string
    const count = Math.min(Math.max(parseInt(args.count) || 2, 1), 4)
    const negativePrompt = args.negative_prompt as string | undefined

    console.error(`[ComfyUI MCP Server] ==========================================`)
    console.error(`[ComfyUI MCP Server] Generating ${count} images...`)
    console.error(`[ComfyUI MCP Server] Prompt: ${prompt}`)
    console.error(`[ComfyUI MCP Server] ==========================================`)

    const allImages: string[] = []

    // Generate multiple images with different seeds
    for (let i = 0; i < count; i++) {
        console.error(`[ComfyUI MCP Server] Generating image ${i + 1}/${count}...`)

        const seed = Math.floor(Math.random() * 1000000000)
        const workflow = buildWorkflowFromTemplate(prompt, negativePrompt || '', seed)

        try {
            const imageBuffer = await queueAndWaitForImage(workflow)
            const compressedBase64 = await compressImageForDisplay(imageBuffer)
            const dataUrl = `data:image/jpeg;base64,${compressedBase64}`
            allImages.push(dataUrl)
        } catch (error: any) {
            console.error(`[ComfyUI MCP Server] Error generating image ${i + 1}:`, error.message)
            // Continue with next image
        }
    }

    if (allImages.length === 0) {
        throw new Error('Failed to generate any images')
    }

    let responseText = `Generated ${allImages.length} images using ${MODEL}!\n\n`
    allImages.forEach((dataUrl, idx) => {
        responseText += `![Image ${idx + 1}](${dataUrl})\n\n`
    })

    return {
        content: [
            {
                type: 'text',
                text: responseText
            }
        ]
    }
}

// Start server
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[ComfyUI MCP Server] Server running on stdio')
}

main().catch((error) => {
    console.error('[ComfyUI MCP Server] Fatal error:', error)
    process.exit(1)
})
