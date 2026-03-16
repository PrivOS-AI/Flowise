/**
 * Bot Message Sender Service
 * Handles sending various types of messages back to Privos Chat Bot API
 */
export interface BotConfig {
    authToken: string
    endPoint: string
    secretKey?: string
}

interface FileOption {
    url: string
    caption?: string
}

export interface SendMessageOptions {
    roomId: string
    text: string
    caption?: string
    files?: FileOption[]
    reply_to_message_id?: string
}

export interface EditMessageOptions {
    messageId: string
    text: string
    roomId: string
}

export interface DeleteMessageOptions {
    messageId: string
    roomId: string
}

export interface FlowResult {
    text?: string
    messageType?: 'text' | 'photo' | 'audio' | 'document' | 'video' | 'voice'
    action: string
    filePath?: string
    caption?: string
    messageId?: string
    [key: string]: any
}

export class BotMessageSender {
    private config: BotConfig

    constructor(config: BotConfig) {
        this.config = config
    }

    private getHeaders(extraHeaders: Record<string, string> = {}) {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.config.authToken}`
        }
        return { ...headers, ...extraHeaders }
    }

    private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
        try {
            const url = `${this.config.endPoint}/bot/${endpoint}`
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    ...this.getHeaders()
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Bot API request failed: ${response.status} ${response.statusText} - ${errorText}`)
            }
            const responseData = await response.json()

            return responseData
        } catch (error) {
            if (error instanceof Error) throw error
            throw new Error(`Bot API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Send a text message to a room
     */
    async sendMessage(options: SendMessageOptions): Promise<any> {
        let messageText = options.text

        // Append files as markdown images if present
        if (options.files && options.files.length > 0) {
            const fileMarkdown = (options.files || []).map((f) => `![${f.caption || f.url}](${f.url})`).join('\n')
            messageText = `${messageText}${messageText ? '\n' : ''}${fileMarkdown}`
        }

        return this.makeRequest('sendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...options,
                text: messageText
            })
        })
    }

    /**
     * Edit a previously sent message
     */
    async editMessage(options: EditMessageOptions): Promise<any> {
        return this.makeRequest('editMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        })
    }

    /**
     * Delete a previously sent message
     */
    async deleteMessage(options: DeleteMessageOptions): Promise<any> {
        return this.makeRequest('deleteMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        })
    }

    /**
     * Process flow result and send appropriate message type
     * This is the main method to be called after flow execution completes
     */
    async sendFlowResult(roomId: string, result: FlowResult): Promise<any> {
        if (result.messageId && result.action === 'delete') {
            return this.deleteMessage({ messageId: result.messageId, roomId })
        }

        if (result.messageId && result.action === 'edit') {
            if (!result.text) throw new Error('Text is required when editing a message')
            return this.editMessage({ messageId: result.messageId, text: result.text, roomId })
        }

        // Handle different message types
        const replyToMessageId = result.messageId

        switch (result.messageType || 'text') {
            case 'text':
            case 'photo':
            case 'audio':
            case 'document':
            case 'video':
            case 'voice':
                if (!result.text) {
                    throw new Error('Text is required for text messages')
                }
                const data = {
                    roomId,
                    text: result?.text,
                    files: result?.files,
                    reply_to_message_id: replyToMessageId,
                    ...(result.metadata ? { ...result.metadata } : {})
                }
                console.log('Sending message with data:', JSON.stringify(data, null, 2))
                return this.sendMessage(data)
            default:
                throw new Error(`Unknown message type: ${result.messageType}`)
        }
    }
}
