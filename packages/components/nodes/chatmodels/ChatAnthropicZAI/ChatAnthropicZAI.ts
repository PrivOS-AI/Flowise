import { AnthropicInput, ChatAnthropic as LangchainChatAnthropic } from '@langchain/anthropic'
import { BaseCache } from '@langchain/core/caches'
import { BaseLLMParams } from '@langchain/core/language_models/llms'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses, getCredentialData } from '../../../src/utils'
import { ChatAnthropicZAI } from './FlowiseChatAnthropicZAI'

class ChatAnthropicZAI_ChatModels implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    description: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'ChatAnthropic Z.AI'
        this.name = 'chatAnthropicZAI'
        this.version = 3.0
        this.type = 'ChatAnthropic'
        this.icon = 'Anthropic.svg'
        this.category = 'Chat Models'
        this.description = 'Z.AI GLM models via Anthropic-compatible API'
        this.baseClasses = [this.type, ...getBaseClasses(LangchainChatAnthropic)]
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['anthropicApi'],
            optional: true
        }
        this.inputs = [
            {
                label: 'BasePath',
                name: 'basepath',
                type: 'string',
                placeholder: 'https://api.z.ai/api/anthropic',
                default: 'https://api.z.ai/api/anthropic'
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'glm-4.6'
            },
            {
                label: 'Temperature',
                name: 'temperature',
                type: 'number',
                step: 0.1,
                default: 0.1
            },
            {
                label: 'Streaming',
                name: 'streaming',
                type: 'boolean'
            },
            {
                label: 'Max Tokens',
                name: 'maxTokens',
                type: 'number'
            },
            {
                label: 'Top P',
                name: 'topP',
                type: 'number',
                step: 0.1,
                default: 1
            },
            {
                label: 'Top K',
                name: 'topK',
                type: 'number',
                step: 0.1,
                default: 0
            }
        ]
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const modelName = (nodeData.inputs?.modelName as string) || 'glm-4.6'
        const temperature = nodeData.inputs?.temperature as string
        const maxTokens = nodeData.inputs?.maxTokens as string
        const topP = nodeData.inputs?.topP as string
        const topK = nodeData.inputs?.topK as string
        const streaming = nodeData.inputs?.streaming as boolean
        const cache = nodeData.inputs?.cache as BaseCache
        const basePath = (nodeData.inputs?.basepath as string) || 'https://api.z.ai/api/anthropic'

        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const apiKey = credentialData?.anthropicApiKey

        const obj: AnthropicInput & BaseLLMParams = {
            model: modelName,
            streaming
        }

        if (temperature) obj.temperature = parseFloat(temperature)
        if (maxTokens) obj.maxTokens = parseInt(maxTokens, 10)
        if (topP) obj.topP = parseFloat(topP)
        if (topK) obj.topK = parseFloat(topK)
        if (cache) obj.cache = cache
        if (apiKey) obj.apiKey = apiKey

        // Use anthropicApiUrl for custom base URL
        if (basePath) {
            ;(obj as any).anthropicApiUrl = basePath
        }

        const model = new ChatAnthropicZAI(nodeData.id, obj)
        return model
    }
}

module.exports = { nodeClass: ChatAnthropicZAI_ChatModels }
