import { AnthropicInput, ChatAnthropic as LangchainChatAnthropic } from '@langchain/anthropic'
import { type BaseChatModelParams } from '@langchain/core/language_models/chat_models'
import { IVisionChatModal, IMultiModalOption } from '../../../src'

const DEFAULT_IMAGE_MODEL = 'glm-4.6'
const DEFAULT_IMAGE_MAX_TOKEN = 2048

export class ChatAnthropicZAI extends LangchainChatAnthropic implements IVisionChatModal {
    configuredModel: string
    configuredMaxToken: number
    multiModalOption: IMultiModalOption
    id: string

    constructor(id: string, fields?: Partial<AnthropicInput> & BaseChatModelParams) {
        super(fields ?? {})
        this.id = id
        this.configuredModel = fields?.model || fields?.modelName || ''
        this.configuredMaxToken = fields?.maxTokens ?? 2048
    }

    revertToOriginalModel(): void {
        this.modelName = this.configuredModel
        this.maxTokens = this.configuredMaxToken
    }

    setMultiModalOption(multiModalOption: IMultiModalOption): void {
        this.multiModalOption = multiModalOption
    }

    setVisionModel(): void {
        if (!this.modelName.startsWith('glm-')) {
            this.modelName = DEFAULT_IMAGE_MODEL
            this.maxTokens = this.configuredMaxToken ? this.configuredMaxToken : DEFAULT_IMAGE_MAX_TOKEN
        }
    }
}
