import FormData from 'form-data'
import fs from 'fs'
import { Readable } from 'stream'

/**
 * Bot Message Sender Service
 * Handles sending various types of messages back to Privos Chat Bot API
 */

export interface BotConfig {
    authToken: string
    endPoint: string
    secretKey?: string
}

export interface SendMessageOptions {
    roomId: string
    text: string
    reply_to_message_id?: string
}

export interface SendPhotoOptions {
    roomId: string
    photo: string | Buffer | Readable
    caption?: string
    reply_to_message_id?: string
}

export interface SendAudioOptions {
    roomId: string
    audio: string | Buffer | Readable
    reply_to_message_id?: string
}

export interface SendDocumentOptions {
    roomId: string
    document: string | Buffer | Readable
    reply_to_message_id?: string
}

export interface SendVideoOptions {
    roomId: string
    video: string | Buffer | Readable
    reply_to_message_id?: string
}

export interface SendVoiceOptions {
    roomId: string
    voice: string | Buffer | Readable
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

    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        try {
            const url = `${this.config.endPoint}/bot/${endpoint}`
            console.log('request bot api url: ', url)
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
            console.log('response bot api: ', responseData)

            return responseData
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }
            throw new Error(`Bot API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Send a text message to a room
     */
    async sendMessage(options: SendMessageOptions): Promise<any> {
        return this.makeRequest('sendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        })
    }

    /**
     * Send a photo to a room
     */
    async sendPhoto(options: SendPhotoOptions): Promise<any> {
        const form = new FormData()
        form.append('roomId', options.roomId)

        if (typeof options.photo === 'string') {
            // Check if it's a file path or URL
            if (fs.existsSync(options.photo)) {
                form.append('photo', fs.createReadStream(options.photo))
            } else {
                form.append('photo', options.photo)
            }
        } else if (options.photo instanceof Buffer) {
            form.append('photo', options.photo, { filename: 'photo.jpg' })
        } else {
            form.append('photo', options.photo)
        }

        if (options.caption) {
            form.append('caption', options.caption)
        }

        if (options.reply_to_message_id) {
            form.append('reply_to_message_id', options.reply_to_message_id)
        }

        return this.makeRequest('sendPhoto', {
            method: 'POST',
            headers: form.getHeaders() as any,
            body: form as any
        })
    }

    /**
     * Send an audio file to a room (.mp3 or .m4a)
     */
    async sendAudio(options: SendAudioOptions): Promise<any> {
        const form = new FormData()
        form.append('roomId', options.roomId)

        if (typeof options.audio === 'string') {
            if (fs.existsSync(options.audio)) {
                form.append('audio', fs.createReadStream(options.audio))
            } else {
                throw new Error('Audio file path does not exist')
            }
        } else if (options.audio instanceof Buffer) {
            form.append('audio', options.audio, { filename: 'audio.mp3' })
        } else {
            form.append('audio', options.audio)
        }

        if (options.reply_to_message_id) {
            form.append('reply_to_message_id', options.reply_to_message_id)
        }

        return this.makeRequest('sendAudio', {
            method: 'POST',
            headers: form.getHeaders() as any,
            body: form as any
        })
    }

    /**
     * Send a document/file to a room (max 50MB)
     */
    async sendDocument(options: SendDocumentOptions): Promise<any> {
        const form = new FormData()
        form.append('roomId', options.roomId)

        if (typeof options.document === 'string') {
            if (fs.existsSync(options.document)) {
                form.append('document', fs.createReadStream(options.document))
            } else {
                throw new Error('Document file path does not exist')
            }
        } else if (options.document instanceof Buffer) {
            form.append('document', options.document, { filename: 'document.pdf' })
        } else {
            form.append('document', options.document)
        }

        if (options.reply_to_message_id) {
            form.append('reply_to_message_id', options.reply_to_message_id)
        }

        return this.makeRequest('sendDocument', {
            method: 'POST',
            headers: form.getHeaders() as any,
            body: form as any
        })
    }

    /**
     * Send a video to a room
     */
    async sendVideo(options: SendVideoOptions): Promise<any> {
        const form = new FormData()
        form.append('roomId', options.roomId)

        if (typeof options.video === 'string') {
            if (fs.existsSync(options.video)) {
                form.append('video', fs.createReadStream(options.video))
            } else {
                throw new Error('Video file path does not exist')
            }
        } else if (options.video instanceof Buffer) {
            form.append('video', options.video, { filename: 'video.mp4' })
        } else {
            form.append('video', options.video)
        }

        if (options.reply_to_message_id) {
            form.append('reply_to_message_id', options.reply_to_message_id)
        }

        return this.makeRequest('sendVideo', {
            method: 'POST',
            headers: form.getHeaders() as any,
            body: form as any
        })
    }

    /**
     * Send a voice message to a room (.ogg, .oga, .opus, .mp3, .webm)
     */
    async sendVoice(options: SendVoiceOptions): Promise<any> {
        const form = new FormData()
        form.append('roomId', options.roomId)

        if (typeof options.voice === 'string') {
            if (fs.existsSync(options.voice)) {
                form.append('voice', fs.createReadStream(options.voice))
            } else {
                throw new Error('Voice file path does not exist')
            }
        } else if (options.voice instanceof Buffer) {
            form.append('voice', options.voice, { filename: 'voice.ogg' })
        } else {
            form.append('voice', options.voice)
        }

        if (options.reply_to_message_id) {
            form.append('reply_to_message_id', options.reply_to_message_id)
        }

        return this.makeRequest('sendVoice', {
            method: 'POST',
            headers: form.getHeaders() as any,
            body: form as any
        })
    }

    /**
     * Edit a previously sent message
     */
    async editMessage(options: EditMessageOptions): Promise<any> {
        console.log('body send msg: ', options)
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
        // Handle delete action
        if (result.messageId && result.action === 'delete') {
            return this.deleteMessage({ messageId: result.messageId, roomId })
        }

        // Handle edit action
        if (result.messageId && result.action === 'edit') {
            if (!result.text) {
                throw new Error('Text is required when editing a message')
            }
            return this.editMessage({ messageId: result.messageId, text: result.text, roomId })
        }

        // Handle different message types
        const replyToMessageId = result.messageId

        switch (result.messageType || 'text') {
            case 'text':
                if (!result.text) {
                    throw new Error('Text is required for text messages')
                }
                return this.sendMessage({
                    roomId,
                    text: result.text,
                    reply_to_message_id: replyToMessageId
                })

            case 'photo':
                if (!result.filePath) {
                    throw new Error('File path is required for photo messages')
                }
                return this.sendPhoto({
                    roomId,
                    photo: result.filePath,
                    caption: result.caption,
                    reply_to_message_id: replyToMessageId
                })

            case 'audio':
                if (!result.filePath) {
                    throw new Error('File path is required for audio messages')
                }
                return this.sendAudio({
                    roomId,
                    audio: result.filePath,
                    reply_to_message_id: replyToMessageId
                })

            case 'document':
                if (!result.filePath) {
                    throw new Error('File path is required for document messages')
                }
                return this.sendDocument({
                    roomId,
                    document: result.filePath,
                    reply_to_message_id: replyToMessageId
                })

            case 'video':
                if (!result.filePath) {
                    throw new Error('File path is required for video messages')
                }
                return this.sendVideo({
                    roomId,
                    video: result.filePath,
                    reply_to_message_id: replyToMessageId
                })

            case 'voice':
                if (!result.filePath) {
                    throw new Error('File path is required for voice messages')
                }
                return this.sendVoice({
                    roomId,
                    voice: result.filePath,
                    reply_to_message_id: replyToMessageId
                })

            default:
                // Default to text message
                if (result.text) {
                    return this.sendMessage({
                        roomId,
                        text: result.text,
                        reply_to_message_id: replyToMessageId
                    })
                }

                throw new Error(`Unknown message type: ${result.messageType}`)
        }
    }
}
