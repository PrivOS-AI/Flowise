import { CallToolRequest, CallToolResultSchema, ListToolsResult, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import { BaseToolkit, tool, Tool } from '@langchain/core/tools'
import { z } from 'zod'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ARTIFACTS_PREFIX } from '../../../src/agents'

export class MCPToolkit extends BaseToolkit {
    tools: Tool[] = []
    _tools: ListToolsResult | null = null
    model_config: any
    transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null
    client: Client | null = null
    serverParams: StdioServerParameters | any
    transportType: 'stdio' | 'sse'
    constructor(serverParams: StdioServerParameters | any, transportType: 'stdio' | 'sse') {
        super()
        this.serverParams = serverParams
        this.transportType = transportType
    }

    // Method to create a new client with transport
    async createClient(): Promise<Client> {
        const client = new Client(
            {
                name: 'flowise-client',
                version: '1.0.0'
            },
            {
                capabilities: {}
            }
        )

        let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport

        if (this.transportType === 'stdio') {
            // Compatible with overridden PATH configuration
            const params = {
                ...this.serverParams,
                env: {
                    ...(this.serverParams.env || {}),
                    PATH: process.env.PATH
                }
            }

            transport = new StdioClientTransport(params as StdioServerParameters)
            await client.connect(transport)
        } else {
            if (this.serverParams.url === undefined) {
                throw new Error('URL is required for SSE transport')
            }

            const baseUrl = new URL(this.serverParams.url)
            try {
                if (this.serverParams.headers) {
                    transport = new StreamableHTTPClientTransport(baseUrl, {
                        requestInit: {
                            headers: this.serverParams.headers
                        }
                    })
                } else {
                    transport = new StreamableHTTPClientTransport(baseUrl)
                }
                await client.connect(transport)
            } catch (error) {
                if (this.serverParams.headers) {
                    transport = new SSEClientTransport(baseUrl, {
                        requestInit: {
                            headers: this.serverParams.headers
                        },
                        eventSourceInit: {
                            fetch: (url, init) => fetch(url, { ...init, headers: this.serverParams.headers })
                        }
                    })
                } else {
                    transport = new SSEClientTransport(baseUrl)
                }
                await client.connect(transport)
            }
        }

        return client
    }

    async initialize() {
        if (this._tools === null) {
            this.client = await this.createClient()

            // Increased timeout for initialization
            this._tools = await this.client.request({ method: 'tools/list' }, ListToolsResultSchema, { timeout: 300000 })

            this.tools = await this.get_tools()

            // Close the initial client after initialization
            await this.client.close()
        }
    }

    async get_tools(): Promise<Tool[]> {
        if (this._tools === null || this.client === null) {
            throw new Error('Must initialize the toolkit first')
        }
        const toolsPromises = this._tools.tools.map(async (tool: any) => {
            if (this.client === null) {
                throw new Error('Client is not initialized')
            }
            return await MCPTool({
                toolkit: this,
                name: tool.name,
                description: tool.description || '',
                argsSchema: createSchemaModel(tool.inputSchema)
            })
        })
        const res = await Promise.allSettled(toolsPromises)
        const errors = res.filter((r) => r.status === 'rejected')
        if (errors.length !== 0) {
            console.error('MCP Tools falied to be resolved', errors)
        }
        const successes = res.filter((r) => r.status === 'fulfilled').map((r) => r.value)
        return successes
    }
}

export async function MCPTool({
    toolkit,
    name,
    description,
    argsSchema
}: {
    toolkit: MCPToolkit
    name: string
    description: string
    argsSchema: any
}): Promise<Tool> {
    return tool(
        async (input): Promise<string> => {
            // Create a new client for this request
            const client = await toolkit.createClient()

            try {
                const req: CallToolRequest = { method: 'tools/call', params: { name: name, arguments: input as any } }
                // 5 minutes timeout for long-running operations like image/video generation
                const res = await client.request(req, CallToolResultSchema, { timeout: 300000 })
                const content = res.content

                // Extract text from content array for proper markdown rendering
                if (Array.isArray(content) && content.length > 0) {
                    // Find first text content
                    const textContent = content.find((item) => item.type === 'text')
                    if (textContent && 'text' in textContent) {
                        const text = textContent.text

                        let cleanedText = text
                        const artifacts: any[] = []

                        // Check if text contains markdown images (data URLs)
                        // Pattern: ![alt](data:image/...;base64,...)
                        const markdownImageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g
                        const imageMatches = [...text.matchAll(markdownImageRegex)]

                        if (imageMatches.length > 0) {
                            for (const match of imageMatches) {
                                // Remove this markdown image from text
                                cleanedText = cleanedText.replace(match[0], '')

                                // Add to artifacts as markdown type (Flowise will render it)
                                artifacts.push({
                                    type: 'markdown',
                                    data: match[0] // Keep the markdown image syntax
                                })
                            }
                        }

                        // Check if text contains HTML video tags
                        // Pattern: <video src="URL" ...></video>
                        const videoRegex = /<video\s+[^>]*src="([^"]+)"[^>]*>.*?<\/video>/gi
                        const videoMatches = [...text.matchAll(videoRegex)]

                        if (videoMatches.length > 0) {
                            for (const match of videoMatches) {
                                // Remove this video tag from text
                                cleanedText = cleanedText.replace(match[0], '')

                                // Add to artifacts as markdown type (Flowise will render HTML)
                                artifacts.push({
                                    type: 'markdown',
                                    data: match[0] // Keep the full video HTML tag
                                })
                            }
                        }

                        // Return text + artifacts if any were found
                        cleanedText = cleanedText.trim()
                        if (artifacts.length > 0) {
                            return cleanedText + ARTIFACTS_PREFIX + JSON.stringify(artifacts)
                        }

                        return text
                    }
                }

                // Fallback to JSON string if no text content found
                const contentString = JSON.stringify(content)
                return contentString
            } finally {
                // Always close the client after the request completes
                await client.close()
            }
        },
        {
            name: name,
            description: description,
            schema: argsSchema
        }
    )
}

function createSchemaModel(
    inputSchema: {
        type: 'object'
        properties?: import('zod').objectOutputType<{}, import('zod').ZodTypeAny, 'passthrough'> | undefined
    } & { [k: string]: unknown }
): any {
    if (inputSchema.type !== 'object' || !inputSchema.properties) {
        throw new Error('Invalid schema type or missing properties')
    }

    const schemaProperties = Object.entries(inputSchema.properties).reduce((acc, [key, _]) => {
        acc[key] = z.any()
        return acc
    }, {} as Record<string, import('zod').ZodTypeAny>)

    return z.object(schemaProperties)
}

export const validateArgsForLocalFileAccess = (args: string[]): void => {
    const dangerousPatterns = [
        // Absolute paths
        /^\/[^/]/, // Unix absolute paths starting with /
        /^[a-zA-Z]:\\/, // Windows absolute paths like C:\

        // Relative paths that could escape current directory
        /\.\.\//, // Parent directory traversal with ../
        /\.\.\\/, // Parent directory traversal with ..\
        /^\.\./, // Starting with ..

        // Local file access patterns
        /^\.\//, // Current directory with ./
        /^~\//, // Home directory with ~/
        /^file:\/\//, // File protocol

        // Common file extensions that shouldn't be accessed
        /\.(exe|bat|cmd|sh|ps1|vbs|scr|com|pif|dll|sys)$/i,

        // File flags and options that could access local files
        /^--?(?:file|input|output|config|load|save|import|export|read|write)=/i,
        /^--?(?:file|input|output|config|load|save|import|export|read|write)$/i
    ]

    for (const arg of args) {
        if (typeof arg !== 'string') continue

        // Check for dangerous patterns
        for (const pattern of dangerousPatterns) {
            if (pattern.test(arg)) {
                throw new Error(`Argument contains potential local file access: "${arg}"`)
            }
        }

        // Check for null bytes
        if (arg.includes('\0')) {
            throw new Error(`Argument contains null byte: "${arg}"`)
        }

        // Check for very long paths that might be used for buffer overflow attacks
        if (arg.length > 1000) {
            throw new Error(`Argument is suspiciously long (${arg.length} characters): "${arg.substring(0, 100)}..."`)
        }
    }
}

export const validateCommandInjection = (args: string[]): void => {
    const dangerousPatterns = [
        // Shell metacharacters
        /[;&|`$(){}[\]<>]/,
        // Command chaining
        /&&|\|\||;;/,
        // Redirections
        />>|<<|>/,
        // Backticks and command substitution
        /`|\$\(/,
        // Process substitution
        /<\(|>\(/
    ]

    for (const arg of args) {
        if (typeof arg !== 'string') continue

        for (const pattern of dangerousPatterns) {
            if (pattern.test(arg)) {
                throw new Error(`Argument contains potentially dangerous characters: "${arg}"`)
            }
        }
    }
}

export const validateEnvironmentVariables = (env: Record<string, any>): void => {
    const dangerousEnvVars = ['PATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH']

    for (const [key, value] of Object.entries(env)) {
        if (dangerousEnvVars.includes(key)) {
            throw new Error(`Environment variable '${key}' modification is not allowed`)
        }

        if (typeof value === 'string' && value.includes('\0')) {
            throw new Error(`Environment variable '${key}' contains null byte`)
        }
    }
}

export const validateMCPServerConfig = (serverParams: any): void => {
    // Validate the entire server configuration
    if (!serverParams || typeof serverParams !== 'object') {
        throw new Error('Invalid server configuration')
    }

    // Command allowlist - only allow specific safe commands
    const allowedCommands = ['node', 'npx', 'python', 'python3', 'docker']

    if (serverParams.command && !allowedCommands.includes(serverParams.command)) {
        throw new Error(`Command '${serverParams.command}' is not allowed. Allowed commands: ${allowedCommands.join(', ')}`)
    }

    // Validate arguments if present
    if (serverParams.args && Array.isArray(serverParams.args)) {
        validateArgsForLocalFileAccess(serverParams.args)
        validateCommandInjection(serverParams.args)
    }

    // Validate environment variables
    if (serverParams.env) {
        validateEnvironmentVariables(serverParams.env)
    }
}
