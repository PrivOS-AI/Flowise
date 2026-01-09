import { ICommonObject, INode, INodeData, INodeParams, IPrivosCredential } from '../../../src/Interface'
import { getCredentialData, handleEscapeCharacters } from '../../../src/utils'
import { secureAxiosRequest } from '../../../src/httpSecurity'

class PrivosSendMessage_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    color: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'Send Message'
        this.name = 'privosSendMessage'
        this.version = 1.0
        this.type = 'PrivosSendMessage'
        this.icon = 'privos.svg'
        this.category = 'PrivOS'
        this.color = '#9C27B0'
        this.description = 'Send message to user via Privos Chat API'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi']
        }
        this.inputs = [
            {
                label: 'User ID',
                name: 'userId',
                type: 'string',
                description: 'ID of the user receiving the message',
                placeholder: '{{$userId}}',
                acceptVariable: true
            },
            {
                label: 'User Bot ID',
                name: 'userBotId',
                type: 'string',
                description: 'ID of the bot sending the message',
                placeholder: '{{$userBotId}}',
                acceptVariable: true
            },
            {
                label: 'Message',
                name: 'message',
                type: 'string',
                rows: 4,
                description: 'Message content to send',
                placeholder: '{{$message}}',
                acceptVariable: true
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const userId = nodeData.inputs?.userId as string
        const userBotId = nodeData.inputs?.userBotId as string
        let message = nodeData.inputs?.message as string

        const state = options.agentflowRuntime?.state as ICommonObject

        try {
            // Validate input parameters
            if (!userId || userId.trim() === '') {
                throw new Error('User ID is required')
            }

            if (!userBotId || userBotId.trim() === '') {
                throw new Error('User Bot ID is required')
            }

            if (!message || message.trim() === '') {
                throw new Error('Message is required')
            }

            // Handle escape characters trong message
            message = handleEscapeCharacters(message, true)

            // Get credentials
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential

            if (!apiKey) {
                throw new Error('API Key is not configured in credential')
            }

            // Build API URL
            const url = `${baseUrl}/internal/agent-chat.sendMessage`

            console.log('Sending message to:', url)
            console.log('User ID:', userId)
            console.log('User Bot ID:', userBotId)

            // Make API request
            const response = await secureAxiosRequest({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                data: {
                    userId: userId.trim(),
                    userBotId: userBotId.trim(),
                    message: message
                }
            })

            console.log('Message sent successfully')

            const responseData = response.data || {}

            // Format output
            const outputContent = `MESSAGE SENT SUCCESSFULLY
${'='.repeat(50)}

User ID: ${userId}
User Bot ID: ${userBotId}

Message Content:
${message}

${'='.repeat(50)}
RESPONSE:
${'='.repeat(50)}

${JSON.stringify(responseData, null, 2)}

${'='.repeat(50)}`

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    userId,
                    userBotId,
                    message
                },
                output: {
                    content: outputContent,
                    success: true,
                    userId,
                    userBotId,
                    message,
                    response: responseData
                },
                state
            }
        } catch (error: any) {
            console.error('Error sending message:', error)

            const errorMessage = error.message || 'Unknown error'
            const errorDetails = error.response?.data || null
            const statusCode = error.response?.status || 500

            const errorContent = `ERROR SENDING MESSAGE
${'='.repeat(50)}

User ID: ${userId || 'N/A'}
User Bot ID: ${userBotId || 'N/A'}

Error: ${errorMessage}
Status Code: ${statusCode}

${errorDetails ? `Error Details:\n${JSON.stringify(errorDetails, null, 2)}` : ''}

${'='.repeat(50)}`

            return {
                id: nodeData.id,
                name: this.name,
                input: {
                    userId: userId || 'N/A',
                    userBotId: userBotId || 'N/A',
                    message: message || 'N/A'
                },
                output: {
                    content: errorContent,
                    success: false,
                    error: errorMessage,
                    details: errorDetails,
                    statusCode: statusCode
                },
                state: state || {}
            }
        }
    }
}

module.exports = { nodeClass: PrivosSendMessage_Agentflow }
