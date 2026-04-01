import { getCredentialData, ICommonObject, INode, INodeData, INodeParams } from '../../../src'
import { DEFAULT_PRIVOS_API_BASE_URL } from '../constants'
import { PrivosErrorHandler } from '../utils'
import { BotMessageSender, FlowResult } from './botMessageSender'

type ActionType = 'send' | 'edit' | 'delete'
type MessageType = 'text' | 'photo' | 'audio' | 'video' | 'document' | 'voice'

class SendMessageToBot_Privos implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    color: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'Send Message To Bot'
        this.name = 'sendMessageToBotPrivos'
        this.version = 2.0
        this.type = 'sendMessageToBot'
        this.category = 'Trigger'
        this.description = 'Send, edit, or delete bot messages (text, image, audio, video, document, voice)'
        this.icon = 'privos.svg'
        this.color = '#4318FF'
        this.baseClasses = [this.type]

        this.inputs = [
            {
                label: 'Action',
                name: 'action',
                type: 'options',
                options: [
                    { label: 'Send Message', name: 'send' },
                    { label: 'Edit Message', name: 'edit' },
                    { label: 'Delete Message', name: 'delete' }
                ],
                default: 'send'
            },
            {
                label: 'Message Type',
                name: 'messageType',
                type: 'options',
                options: [
                    { label: 'Text', name: 'text' },
                    { label: 'Image', name: 'photo' },
                    { label: 'Audio', name: 'audio' },
                    { label: 'Video', name: 'video' },
                    { label: 'Document', name: 'document' },
                    { label: 'Voice', name: 'voice' },
                    { label: 'Photo', name: 'photo' }
                ],
                default: 'text',
                show: { action: ['send'] }
            },
            {
                label: 'Text',
                name: 'text',
                type: 'string',
                rows: 4,
                description: 'Message text',
                placeholder: 'Enter message text...',
                acceptVariable: true,
                show: { action: ['send', 'edit'] }
            },
            {
                label: 'Reply Message ID',
                name: 'replyToMessageId',
                type: 'string',
                rows: 2,
                description: 'ID of the message to reply to',
                placeholder: 'Enter reply message ID...',
                acceptVariable: true,
                show: { action: ['send', 'edit'] }
            },
            {
                label: 'Metadata',
                name: 'metadata',
                type: 'string',
                rows: 2,
                description: 'Additional metadata for the message',
                placeholder: 'Enter metadata...',
                acceptVariable: true,
                show: { action: ['send', 'edit'] }
            },
            {
                label: 'Files',
                name: 'files',
                type: 'string',
                rows: 6,
                description:
                    'JSON array of files. Format: [{"url":"https://...", "caption":"text1"}, {"url":"https://...", "caption":"text2"}]',
                placeholder: '[{"url":"https://example.com/image.jpg","caption":"My Image"}]',
                acceptVariable: true,
                optional: true,
                show: {
                    action: ['send'],
                    messageType: ['photo', 'audio', 'video', 'document', 'voice']
                }
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const state = options.agentflowRuntime?.state
        const { messageId, roomId, botCredentialId } = options.triggerData || {}

        const action = nodeData.inputs?.action as ActionType
        const messageType = nodeData.inputs?.messageType as MessageType
        const text = nodeData.inputs?.text as string
        const filesJson = nodeData.inputs?.files as string
        const replyToMessageId = nodeData.inputs?.replyToMessageId as string
        const metadata = nodeData.inputs?.metadata as string

        const finalRoomId = (nodeData.inputs?.roomId as string) || roomId

        try {
            // ===== VALIDATION =====
            if (!finalRoomId) throw new Error('Room ID is required')

            if (action === 'send') {
                if (messageType === 'text' && (!text || !text.trim())) {
                    throw new Error('Text is required for text messages')
                }
            }

            if (action === 'edit' && !messageId) {
                throw new Error('Edit Message ID is required')
            }

            if (action === 'delete' && !messageId) {
                throw new Error('Delete Message ID is required')
            }

            // ===== CREDENTIAL =====
            const { authToken, secretKey } = (await getCredentialData(botCredentialId, options)) as any

            const sender = new BotMessageSender({
                endPoint: DEFAULT_PRIVOS_API_BASE_URL,
                authToken,
                secretKey
            })

            // ===== BUILD FLOW RESULT =====
            const flowResult: FlowResult = {
                action,
                messageId: replyToMessageId || messageId,
                ...((metadata && { metadata: JSON.parse(metadata) }) || {})
            }

            if (action === 'edit') flowResult.text = text

            // ===== PARSE FILES =====
            let files: Array<{ url: string; caption?: string }> = []
            if (filesJson && filesJson.trim()) {
                try {
                    const unescapedJson = filesJson.replace(/\\/g, '')
                    const parsed = JSON.parse(unescapedJson)
                    if (!Array.isArray(parsed)) throw new Error('Files must be a JSON array')
                    files = parsed
                        .filter((f: any) => f.url)
                        .map((f: any) => ({
                            url: f.url,
                            caption: f.caption || undefined
                        }))
                } catch (e: any) {
                    throw new Error(`Invalid files JSON format: ${e.message}`)
                }
            }

            if (action === 'send') {
                flowResult.messageType = messageType
                flowResult.text = text
                if (files.length > 0) flowResult.files = files
            }

            const response = await sender.sendFlowResult(finalRoomId, flowResult)

            return {
                id: nodeData.id,
                name: this.name,
                input: nodeData.inputs,
                output: {
                    content: JSON.stringify(response, null, 2)
                },
                state
            }
        } catch (error: any) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }
}

module.exports = { nodeClass: SendMessageToBot_Privos }
