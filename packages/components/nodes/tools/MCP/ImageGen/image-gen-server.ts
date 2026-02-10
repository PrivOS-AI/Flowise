#!/usr/bin/env node

/**
 * MCP Server for Image Generation using Gemini 2.5 Flash Image
 * This is a proper MCP server that exposes image generation as a tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
import { GoogleGenAI } from '@google/genai'

// Helper function to get and validate API key
function getGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required')
    }
    return apiKey
}

// Helper function to get default model from environment
function getDefaultModel(): string {
    return process.env.DEFAULT_MODEL || 'gemini-2.0-flash-preview-image-generation'
}

// Define available tools
const TOOLS: Tool[] = [
    {
        name: 'generate_image',
        description:
            'Generate an image from a text prompt using Google Gemini/Imagen models. Supports Gemini 2.5/2.0 Flash (free, fast) and Imagen 3.0/4.0 variants (paid, high quality). Returns base64 encoded image data.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description:
                        'A detailed description of the image you want to generate. Be specific about style, composition, lighting, and subject matter.'
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid in the image (e.g., "blurry, low quality, distorted, text, watermark")'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'generate_multiple_images',
        description: 'Generate multiple image variations from a single prompt. Useful for exploring different interpretations.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'A detailed description of the image you want to generate'
                },
                count: {
                    type: 'number',
                    description: 'Number of variations to generate (1-4)',
                    minimum: 1,
                    maximum: 4,
                    default: 2
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid in the images'
                }
            },
            required: ['prompt']
        }
    }
]

// Create MCP server
const server = new Server(
    {
        name: 'image-generation-server',
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
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error.message}`
                }
            ],
            isError: true
        }
    }
})

/**
 * Generate a single image
 */
async function generateImage(args: any) {
    const prompt = args.prompt as string
    const negativePrompt = args.negative_prompt as string | undefined
    // Always use default model from environment (set via UI dropdown)
    const modelName = getDefaultModel()

    // Build full prompt
    let fullPrompt = prompt
    if (negativePrompt) {
        fullPrompt += `\n\nAvoid: ${negativePrompt}`
    }

    // Get API key and initialize Gemini AI
    const apiKey = getGeminiApiKey()
    const apiKeyPreview = apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4)

    console.error(`[MCP Server] ==========================================`)
    console.error(`[MCP Server] Generating image with model: ${modelName}`)
    console.error(`[MCP Server] API Key: ${apiKeyPreview}`)
    console.error(`[MCP Server] Prompt: ${prompt}`)
    console.error(`[MCP Server] ==========================================`)

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({ apiKey })

    // Detect model type and use appropriate API
    const isImagenModel = modelName.startsWith('imagen-')
    const images: any[] = []

    console.error(`[MCP Server] Calling ${isImagenModel ? 'Imagen' : 'Gemini'} API...`)

    try {
        if (isImagenModel) {
            // Use generateImages for Imagen models
            const response = await ai.models.generateImages({
                model: modelName,
                prompt: fullPrompt,
                config: {
                    numberOfImages: 1
                }
            })

            console.error(
                `[MCP Server] Response received:`,
                JSON.stringify({
                    generatedImages: response.generatedImages?.length || 0
                })
            )

            // Extract images from Imagen response
            if (response.generatedImages) {
                for (const generatedImage of response.generatedImages) {
                    const imageBytes = generatedImage.image?.imageBytes
                    if (imageBytes) {
                        images.push({
                            mimeType: 'image/png',
                            data: imageBytes,
                            size: Math.round(imageBytes.length * 0.75)
                        })
                    }
                }
            }
        } else {
            // Use generateContent for Gemini models
            const response = await ai.models.generateContent({
                model: modelName,
                contents: fullPrompt,
                config: {
                    responseModalities: ['IMAGE', 'TEXT']
                }
            })

            console.error(
                `[MCP Server] Response received:`,
                JSON.stringify({
                    candidates: response.candidates?.length || 0
                })
            )

            // Extract images from Gemini response
            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) {
                        console.error(`[MCP Server] Part type: text`)
                    } else if (part.inlineData) {
                        console.error(`[MCP Server] Part type: image`)
                        const imageData = part.inlineData.data
                        if (imageData) {
                            images.push({
                                mimeType: part.inlineData.mimeType || 'image/png',
                                data: imageData,
                                size: Math.round(imageData.length * 0.75)
                            })
                        }
                    }
                }
            }
        }

        console.error(`[MCP Server] Images found: ${images.length}`)

        if (images.length === 0) {
            console.error(`[MCP Server] No images in response`)
            throw new Error('No images were generated. The request may have been blocked by safety filters.')
        }
    } catch (apiError: any) {
        console.error(`[MCP Server] API Error:`, apiError.message)
        console.error(`[MCP Server] API Error stack:`, apiError.stack)
        throw new Error(`Google AI API error: ${apiError.message || apiError}`)
    }

    const image = images[0]
    const originalSizeKB = (image.size / 1024).toFixed(2)

    // Use original image (no compression) - will be saved to storage for full quality
    console.error(`[MCP Server] Using original image (no compression) - ${originalSizeKB} KB`)

    // Create data URL with original image
    const dataUrl = `data:image/jpeg;base64,${image.data}`

    return {
        content: [
            {
                type: 'text',
                text: `Image generated successfully!\n![Generated Image](${dataUrl})`
            }
        ]
    }
}

/**
 * Generate multiple images (variations)
 */
async function generateMultipleImages(args: any) {
    const prompt = args.prompt as string
    const count = Math.min(Math.max(parseInt(args.count) || 2, 1), 4)
    const negativePrompt = args.negative_prompt as string | undefined
    // Always use default model from environment (set via UI dropdown)
    const modelName = getDefaultModel()

    // Get API key and initialize Gemini AI
    const apiKey = getGeminiApiKey()
    const apiKeyPreview = apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4)

    console.error(`[MCP Server] ==========================================`)
    console.error(`[MCP Server] Generating ${count} images with model: ${modelName}`)
    console.error(`[MCP Server] API Key: ${apiKeyPreview}`)
    console.error(`[MCP Server] Prompt: ${prompt}`)
    console.error(`[MCP Server] ==========================================`)

    // Build full prompt
    let fullPrompt = prompt
    if (negativePrompt) {
        fullPrompt += `\n\nAvoid: ${negativePrompt}`
    }

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({ apiKey })

    // Detect model type
    const isImagenModel = modelName.startsWith('imagen-')
    const allImages: any[] = []

    if (isImagenModel) {
        // For Imagen models, use generateImages with numberOfImages config
        console.error(`[MCP Server] Generating ${count} images with Imagen...`)

        try {
            const response = await ai.models.generateImages({
                model: modelName,
                prompt: fullPrompt,
                config: {
                    numberOfImages: count
                }
            })

            // Extract all images from Imagen response
            if (response.generatedImages) {
                for (let i = 0; i < response.generatedImages.length; i++) {
                    const imageBytes = response.generatedImages[i].image?.imageBytes
                    if (imageBytes) {
                        allImages.push({
                            index: i + 1,
                            mimeType: 'image/png',
                            data: imageBytes,
                            size: Math.round(imageBytes.length * 0.75)
                        })
                    }
                }
            }
        } catch (error: any) {
            console.error(`[MCP Server] Error generating images:`, error.message)
            throw error
        }
    } else {
        // For Gemini models, generate multiple images by calling API multiple times
        for (let i = 0; i < count; i++) {
            console.error(`[MCP Server] Generating image ${i + 1}/${count}...`)

            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: fullPrompt,
                    config: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                })

                // Extract image data from response
                if (response.candidates && response.candidates[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const imageData = part.inlineData.data
                            if (imageData) {
                                allImages.push({
                                    index: i + 1,
                                    mimeType: part.inlineData.mimeType || 'image/png',
                                    data: imageData,
                                    size: Math.round(imageData.length * 0.75)
                                })
                            }
                        }
                    }
                }
            } catch (error: any) {
                console.error(`[MCP Server] Error generating image ${i + 1}:`, error.message)
                // Continue with next image
            }
        }
    }

    if (allImages.length === 0) {
        throw new Error('No images were generated. The request may have been blocked by safety filters.')
    }

    // Build response text with compressed images
    let responseText = `Generated ${allImages.length} images successfully!\n\n`

    // Add each original image (no compression) to response
    for (let idx = 0; idx < allImages.length; idx++) {
        const img = allImages[idx]
        const originalSizeKB = (img.size / 1024).toFixed(2)
        console.error(`[MCP Server] Adding image ${idx + 1}/${allImages.length} (original quality) - ${originalSizeKB} KB`)

        const dataUrl = `data:image/jpeg;base64,${img.data}`
        responseText += `![Image ${idx + 1}](${dataUrl})\n\n`
    }

    return {
        content: [
            {
                type: 'text',
                text: responseText
            }
        ]
    }
}

// Start server with STDIO transport
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[MCP Server] Image Generation MCP Server running on stdio')
}

main().catch((error) => {
    console.error('[MCP Server] Fatal error:', error)
    process.exit(1)
})
