#!/usr/bin/env node

/**
 * MCP Server for Image Generation using Gemini 2.5 Flash Image
 * This is a proper MCP server that exposes image generation as a tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
            'Generate an image from a text prompt using Google Gemini/Imagen models. Supports Gemini 2.5/2.0 Flash (free, fast) and Imagen 4.0 variants (Fast, Generate, Ultra). Returns base64 encoded image data.',
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
    const genAI = new GoogleGenerativeAI(apiKey)

    // Get model with generation config for image generation
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'] // CRITICAL: Tell API to return images!
        } as any // Type assertion: SDK v0.24.0 doesn't have this type yet but API supports it
    })

    // Generate content
    const result = await model.generateContent(fullPrompt)
    const response = result.response

    console.error(
        `[MCP Server] Response received:`,
        JSON.stringify({
            candidates: response.candidates?.length || 0,
            text: response.text?.() || 'no text'
        })
    )

    // Extract image data
    const candidates = response.candidates || []
    const images: any[] = []

    for (const candidate of candidates) {
        if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
                console.error(`[MCP Server] Part type:`, part.inlineData ? 'image' : part.text ? 'text' : 'unknown')
                if (part.inlineData) {
                    images.push({
                        mimeType: part.inlineData.mimeType || 'image/png',
                        data: part.inlineData.data,
                        size: Math.round(part.inlineData.data.length * 0.75)
                    })
                }
            }
        }
    }

    console.error(`[MCP Server] Images found: ${images.length}`)

    if (images.length === 0) {
        // Log full response for debugging
        console.error(`[MCP Server] Full response:`, JSON.stringify(response, null, 2))
        throw new Error(
            'No images were generated. The request may have been blocked by safety filters or model does not support image generation.'
        )
    }

    const image = images[0]
    const sizeKB = (image.size / 1024).toFixed(2)

    return {
        content: [
            {
                type: 'text',
                text: `Image generated successfully!\n\nModel: ${modelName}\nPrompt: ${prompt}\nSize: ~${sizeKB} KB\nFormat: ${
                    image.mimeType
                }\n\nBase64 data (first 100 chars): ${image.data.substring(0, 100)}...`
            },
            {
                type: 'text',
                text: JSON.stringify(
                    {
                        success: true,
                        model: modelName,
                        prompt: prompt,
                        negativePrompt: negativePrompt || null,
                        image: {
                            mimeType: image.mimeType,
                            data: image.data,
                            dataUrl: `data:${image.mimeType};base64,${image.data}`,
                            size: image.size
                        }
                    },
                    null,
                    2
                )
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
    const genAI = new GoogleGenerativeAI(apiKey)

    // Get model with generation config for image generation
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'] // CRITICAL: Tell API to return images!
        } as any // Type assertion: SDK v0.24.0 doesn't have this type yet but API supports it
    })

    // Generate multiple images by calling API multiple times
    const allImages: any[] = []

    for (let i = 0; i < count; i++) {
        console.error(`[MCP Server] Generating image ${i + 1}/${count}...`)

        const result = await model.generateContent(fullPrompt)
        const response = result.response

        // Extract image data
        const candidates = response.candidates || []

        for (const candidate of candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        allImages.push({
                            index: i + 1,
                            mimeType: part.inlineData.mimeType || 'image/png',
                            data: part.inlineData.data,
                            size: Math.round(part.inlineData.data.length * 0.75)
                        })
                    }
                }
            }
        }
    }

    if (allImages.length === 0) {
        throw new Error('No images were generated. The request may have been blocked by safety filters.')
    }

    // Build response text
    let responseText = `✅ Generated ${allImages.length} images successfully!\n\n`
    responseText += `Model: ${modelName}\n`
    responseText += `Prompt: ${prompt}\n\n`

    allImages.forEach((img, idx) => {
        const sizeKB = (img.size / 1024).toFixed(2)
        responseText += `Image ${idx + 1}: ${img.mimeType}, ~${sizeKB} KB\n`
    })

    return {
        content: [
            {
                type: 'text',
                text: responseText
            },
            {
                type: 'text',
                text: JSON.stringify(
                    {
                        success: true,
                        model: modelName,
                        prompt: prompt,
                        negativePrompt: negativePrompt || null,
                        count: allImages.length,
                        images: allImages.map((img) => ({
                            index: img.index,
                            mimeType: img.mimeType,
                            data: img.data,
                            dataUrl: `data:${img.mimeType};base64,${img.data}`,
                            size: img.size
                        }))
                    },
                    null,
                    2
                )
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
