#!/usr/bin/env node

/**
 * MCP Server for Video Generation using Google Veo 2.0
 * This is a proper MCP server that exposes video generation as a tool
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
    return process.env.DEFAULT_MODEL || 'veo-2.0-generate-001'
}

// Define available tools
const TOOLS: Tool[] = [
    {
        name: 'generate_video',
        description:
            'Generate a video from a text prompt using Google Veo 2.0. Creates high-quality videos up to 10 seconds long. This is an async operation that may take 30-120 seconds to complete.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description:
                        'A detailed description of the video you want to generate. Be specific about motion, camera movement, lighting, and scene details.'
                },
                aspect_ratio: {
                    type: 'string',
                    enum: ['16:9', '9:16'],
                    description: 'Video aspect ratio. Use 16:9 for landscape (default), 9:16 for vertical/mobile video.',
                    default: '16:9'
                },
                person_generation: {
                    type: 'string',
                    enum: ['dont_allow', 'allow_adult'],
                    description:
                        'Whether to allow generation of people. Use "dont_allow" to avoid generating people, "allow_adult" to allow adult faces.',
                    default: 'dont_allow'
                },
                duration_seconds: {
                    type: 'number',
                    description: 'Duration of the video in seconds (typically 5-10 seconds). Default: 5',
                    minimum: 2,
                    maximum: 10,
                    default: 5
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid in the video (e.g., "blurry, low quality, distorted, shaky camera")'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'generate_video_from_image',
        description:
            'Generate a video from an input image using Google Veo 2.0 (image-to-video). Animates a static image based on the prompt. This is an async operation that may take 30-120 seconds.',
        inputSchema: {
            type: 'object',
            properties: {
                image_base64: {
                    type: 'string',
                    description: 'Base64-encoded image data (without data URI prefix, just the base64 string)'
                },
                image_mime_type: {
                    type: 'string',
                    description: 'MIME type of the image (e.g., "image/jpeg", "image/png")',
                    default: 'image/jpeg'
                },
                prompt: {
                    type: 'string',
                    description: 'Description of how the image should be animated. Describe motion, camera movement, and desired action.',
                    default: 'Animate this image naturally'
                },
                aspect_ratio: {
                    type: 'string',
                    enum: ['16:9', '9:16'],
                    description: 'Video aspect ratio. Use 16:9 for landscape (default), 9:16 for vertical/mobile video.',
                    default: '16:9'
                },
                duration_seconds: {
                    type: 'number',
                    description: 'Duration of the video in seconds (typically 5-10 seconds). Default: 5',
                    minimum: 2,
                    maximum: 10,
                    default: 5
                },
                negative_prompt: {
                    type: 'string',
                    description: 'Optional: What to avoid in the video animation'
                }
            },
            required: ['image_base64']
        }
    }
]

// Create MCP server
const server = new Server(
    {
        name: 'video-generation-server',
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
        if (name === 'generate_video') {
            return await generateVideo(args)
        } else if (name === 'generate_video_from_image') {
            return await generateVideoFromImage(args)
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
 * Generate a video from text prompt
 */
async function generateVideo(args: any) {
    const prompt = args.prompt as string
    const aspectRatio = (args.aspect_ratio || '16:9') as '16:9' | '9:16'
    const personGeneration = (args.person_generation || 'dont_allow') as 'dont_allow' | 'allow_adult'
    const durationSeconds = parseInt(args.duration_seconds) || 5
    const negativePrompt = args.negative_prompt as string | undefined
    const modelName = getDefaultModel()

    // Build full prompt
    let fullPrompt = prompt
    if (negativePrompt) {
        fullPrompt += `\n\nAvoid: ${negativePrompt}`
    }

    // Get API key and initialize client
    const apiKey = getGeminiApiKey()
    const apiKeyPreview = apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4)

    console.error(`[MCP Server] ==========================================`)
    console.error(`[MCP Server] Generating video with model: ${modelName}`)
    console.error(`[MCP Server] API Key: ${apiKeyPreview}`)
    console.error(`[MCP Server] Prompt: ${prompt}`)
    console.error(`[MCP Server] Config: ${JSON.stringify({ aspectRatio, personGeneration, durationSeconds })}`)
    console.error(`[MCP Server] ==========================================`)

    const ai = new GoogleGenAI({ apiKey })

    try {
        // Call generateVideos API
        console.error(`[MCP Server] Calling generateVideos API...`)
        let operation = await ai.models.generateVideos({
            model: modelName,
            prompt: fullPrompt,
            config: {
                aspectRatio: aspectRatio,
                personGeneration: personGeneration,
                durationSeconds: durationSeconds
            }
        })

        console.error(`[MCP Server] Operation started, polling for completion...`)

        // Poll until the operation is complete
        let pollCount = 0
        const maxPolls = 60 // 5 minutes max (5 seconds * 60)

        while (!operation.done && pollCount < maxPolls) {
            pollCount++
            console.error(`[MCP Server] Polling... (${pollCount}/${maxPolls})`)

            // Wait 5 seconds before checking again
            await new Promise((resolve) => setTimeout(resolve, 5000))

            operation = await ai.operations.getVideosOperation({
                operation: operation
            })
        }

        if (!operation.done) {
            throw new Error('Video generation timed out after 5 minutes')
        }

        console.error(`[MCP Server] Video generation complete!`)

        // Check if we have generated videos
        if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
            throw new Error('No videos generated in the response')
        }

        const generatedVideo = operation.response.generatedVideos[0]
        if (!generatedVideo.video?.uri) {
            throw new Error('Generated video missing URI')
        }

        // Append API key to the URI for access
        const videoUri = `${generatedVideo.video.uri}&key=${apiKey}`

        console.error(`[MCP Server] Video URI: ${generatedVideo.video.uri}`)

        // Return HTML video tag for UI display
        const videoHtml = `<video src="${videoUri}" controls width="640" style="max-width: 100%;"></video>`

        return {
            content: [
                {
                    type: 'text',
                    text: `Video generated successfully!\n\n${videoHtml}\n\n**Duration:** ${durationSeconds}s | **Aspect Ratio:** ${aspectRatio} | **Model:** ${modelName}\n\n*Note: Video URL is temporary and will expire in a few hours.*`
                }
            ]
        }
    } catch (apiError: any) {
        console.error(`[MCP Server] API Error:`, apiError.message)
        console.error(`[MCP Server] API Error stack:`, apiError.stack)
        throw new Error(`Google AI API error: ${apiError.message || apiError}`)
    }
}

/**
 * Generate a video from an image
 */
async function generateVideoFromImage(args: any) {
    const imageBase64 = args.image_base64 as string
    const imageMimeType = (args.image_mime_type || 'image/jpeg') as string
    const prompt = (args.prompt || 'Animate this image naturally') as string
    const aspectRatio = (args.aspect_ratio || '16:9') as '16:9' | '9:16'
    const durationSeconds = parseInt(args.duration_seconds) || 5
    const negativePrompt = args.negative_prompt as string | undefined
    const modelName = getDefaultModel()

    // Build full prompt
    let fullPrompt = prompt
    if (negativePrompt) {
        fullPrompt += `\n\nAvoid: ${negativePrompt}`
    }

    // Get API key and initialize client
    const apiKey = getGeminiApiKey()
    const apiKeyPreview = apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4)

    console.error(`[MCP Server] ==========================================`)
    console.error(`[MCP Server] Generating video from image with model: ${modelName}`)
    console.error(`[MCP Server] API Key: ${apiKeyPreview}`)
    console.error(`[MCP Server] Prompt: ${prompt}`)
    console.error(`[MCP Server] Image MIME type: ${imageMimeType}`)
    console.error(`[MCP Server] Config: ${JSON.stringify({ aspectRatio, durationSeconds })}`)
    console.error(`[MCP Server] ==========================================`)

    const ai = new GoogleGenAI({ apiKey })

    try {
        // Call generateVideos API with image
        console.error(`[MCP Server] Calling generateVideos API with image...`)
        let operation = await ai.models.generateVideos({
            model: modelName,
            prompt: fullPrompt,
            image: {
                imageBytes: imageBase64,
                mimeType: imageMimeType
            },
            config: {
                aspectRatio: aspectRatio,
                durationSeconds: durationSeconds
                // Note: personGeneration not allowed for image-to-video
            }
        })

        console.error(`[MCP Server] Operation started, polling for completion...`)

        // Poll until the operation is complete
        let pollCount = 0
        const maxPolls = 60 // 5 minutes max

        while (!operation.done && pollCount < maxPolls) {
            pollCount++
            console.error(`[MCP Server] Polling... (${pollCount}/${maxPolls})`)

            // Wait 5 seconds before checking again
            await new Promise((resolve) => setTimeout(resolve, 5000))

            operation = await ai.operations.getVideosOperation({
                operation: operation
            })
        }

        if (!operation.done) {
            throw new Error('Video generation timed out after 5 minutes')
        }

        console.error(`[MCP Server] Video generation complete!`)

        // Check if we have generated videos
        if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
            throw new Error('No videos generated in the response')
        }

        const generatedVideo = operation.response.generatedVideos[0]
        if (!generatedVideo.video?.uri) {
            throw new Error('Generated video missing URI')
        }

        // Append API key to the URI for access
        const videoUri = `${generatedVideo.video.uri}&key=${apiKey}`

        console.error(`[MCP Server] Video URI: ${generatedVideo.video.uri}`)

        // Return HTML video tag for UI display
        const videoHtml = `<video src="${videoUri}" controls width="640" style="max-width: 100%;"></video>`

        return {
            content: [
                {
                    type: 'text',
                    text: `Video generated from image successfully!\n\n${videoHtml}\n\n**Duration:** ${durationSeconds}s | **Aspect Ratio:** ${aspectRatio} | **Model:** ${modelName}\n\n*Note: Video URL is temporary and will expire in a few hours.*`
                }
            ]
        }
    } catch (apiError: any) {
        console.error(`[MCP Server] API Error:`, apiError.message)
        console.error(`[MCP Server] API Error stack:`, apiError.stack)
        throw new Error(`Google AI API error: ${apiError.message || apiError}`)
    }
}

// Start server with STDIO transport
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[MCP Server] Video Generation MCP Server running on stdio')
}

main().catch((error) => {
    console.error('[MCP Server] Fatal error:', error)
    process.exit(1)
})
