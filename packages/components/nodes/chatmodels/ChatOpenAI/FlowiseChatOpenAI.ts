import { ChatOpenAI as LangchainChatOpenAI, ChatOpenAIFields } from '@langchain/openai'
import { IMultiModalOption, IVisionChatModal } from '../../../src'
import { BaseMessage, AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'

type ReasoningType = 'openai_responses' | 'deepseek' | 'qwen' | 'gpt-oss' | 'openrouter' | 'other' | 'none'

interface OpenAIStreamChunk {
    choices: Array<{
        delta: {
            content?: string
            reasoning?: string
            reasoning_content?: string
            thinking?: string
            [key: string]: any
        }
        finish_reason?: string
        [key: string]: any
    }>
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
    }
    [key: string]: any
}

export class ChatOpenAI extends LangchainChatOpenAI implements IVisionChatModal {
    configuredModel: string
    configuredMaxToken?: number
    multiModalOption: IMultiModalOption
    builtInTools: Record<string, any>[] = []
    id: string
    private thinkingBuffer: string = ''
    private isInThinking: boolean = false
    private thinkingTagBuffer: string = '' // Buffer for handling split tags across chunks

    constructor(id: string, fields?: ChatOpenAIFields) {
        super(fields)
        this.id = id
        this.configuredModel = fields?.model ?? ''
        this.configuredMaxToken = fields?.maxTokens
    }

    revertToOriginalModel(): void {
        this.model = this.configuredModel
        this.maxTokens = this.configuredMaxToken
    }

    setMultiModalOption(multiModalOption: IMultiModalOption): void {
        this.multiModalOption = multiModalOption
    }

    setVisionModel(): void {
        // pass
    }

    addBuiltInTools(builtInTool: Record<string, any>): void {
        this.builtInTools.push(builtInTool)
    }

    /**
     * Detect model provider and reasoning type
     */
    private detectReasoningType(): ReasoningType {
        const model = this.model.toLowerCase()

        // OpenAI Responses API models (o1, o3, o4-mini, gpt-5)
        if (model.includes('o1') || model.includes('o3') || model.includes('o4-mini') || model.includes('gpt-5')) {
            return 'openai_responses'
        }

        // DeepSeek models - use reasoning_content field
        if (model.includes('deepseek')) {
            return 'deepseek'
        }

        // Qwen models - use think tags (escaped backticks)
        if (model.includes('qwen')) {
            return 'qwen'
        }

        // Other models that might have reasoning/thinking fields
        if (model.includes('r1') || model.includes('reasoning') || model.includes('thinking')) {
            return 'other'
        }

        return 'none'
    }

    /**
     * Override _streamResponseChunks to handle reasoning from multiple providers
     *
     * Supported providers:
     * - OpenAI o1/o3/o4: Uses Responses API automatically
     * - DeepSeek: Uses delta.reasoning_content field
     * - Qwen: Uses ```...``` tags in content
     * - Other: Generic handling for reasoning/thinking fields
     */
    async *_streamResponseChunks(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): AsyncGenerator<ChatGenerationChunk> {
        // Reset thinking state
        this.thinkingBuffer = ''
        this.isInThinking = false
        this.thinkingTagBuffer = ''

        const reasoningType = this.detectReasoningType()

        // For OpenAI Responses API, let parent handle it automatically
        if (reasoningType === 'openai_responses' && (this as any).useResponsesApi) {
            const parentStream = super._streamResponseChunks(messages, options, runManager)
            for await (const chunk of parentStream) {
                yield chunk
            }
            return
        }

        // For other providers, manually extract reasoning
        const parentStream = super._streamResponseChunks(messages, options, runManager)

        try {
            const client = (this as any).client

            if (!client) {
                // Fallback if no client available
                for await (const chunk of parentStream) {
                    yield chunk
                }
                return
            }

            // Build request params
            const params: any = {
                model: this.model,
                stream: true,
                stream_options: { include_usage: true },
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                top_p: this.topP,
                frequency_penalty: this.frequencyPenalty,
                presence_penalty: this.presencePenalty,
                stop: options?.stop
            }

            // Convert messages to OpenAI format
            const openaiMessages = messages.map((msg) => {
                const type = msg._getType()
                if (type === 'human' || type === 'generic') {
                    return { role: 'user', content: typeof msg.content === 'string' ? msg.content : msg.content }
                } else if (type === 'ai') {
                    return { role: 'assistant', content: typeof msg.content === 'string' ? msg.content : msg.content }
                } else if (type === 'system') {
                    return { role: 'system', content: typeof msg.content === 'string' ? msg.content : msg.content }
                } else if (type === 'tool') {
                    return { role: 'tool', content: msg.content as string }
                }
                return { role: 'user', content: '' }
            })

            const stream = await client.chat.completions.create({
                ...params,
                messages: openaiMessages
            })

            const usageMetadata = {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0
            }

            for await (const chunk of stream) {
                if (options.signal?.aborted) {
                    break
                }

                const choice = chunk.choices?.[0]
                const delta = choice?.delta

                // Update usage metadata
                if (chunk.usage) {
                    usageMetadata.input_tokens = chunk.usage.prompt_tokens || 0
                    usageMetadata.output_tokens = chunk.usage.completion_tokens || 0
                    usageMetadata.total_tokens = chunk.usage.total_tokens || 0
                }

                // Process reasoning based on provider type
                let reasoningContent = ''
                let regularContent = ''

                if (reasoningType === 'deepseek') {
                    // DeepSeek: Use reasoning_content field
                    reasoningContent = delta?.reasoning_content || ''
                    regularContent = delta?.content || ''
                } else if (reasoningType === 'qwen') {
                    // Qwen: Parse ```` tags from content
                    const content = delta?.content || ''
                    if (content) {
                        this.thinkingTagBuffer += content

                        // Check for ```` tag
                        if (this.thinkingTagBuffer.includes('````')) {
                            this.isInThinking = true
                            // Extract thinking content between tags
                            const thinkMatch = this.thinkingTagBuffer.match(/````(.*?)(````|$)/s)
                            if (thinkMatch) {
                                reasoningContent = thinkMatch[1]
                                if (this.thinkingTagBuffer.includes('```')) {
                                    this.isInThinking = false
                                    // Get content after ```
                                    regularContent = this.thinkingTagBuffer.split('```')[1] || ''
                                    this.thinkingTagBuffer = ''
                                }
                            }
                        } else if (this.isInThinking) {
                            // Still in thinking mode, accumulate
                            reasoningContent = content
                        } else {
                            // Regular content
                            regularContent = content
                            this.thinkingTagBuffer = ''
                        }
                    }
                } else if (reasoningType === 'other') {
                    // Generic handling for other reasoning models
                    reasoningContent = delta?.reasoning || delta?.thinking || ''
                    regularContent = delta?.content || ''
                } else {
                    // No reasoning, just regular content
                    regularContent = delta?.content || ''
                }

                // Yield reasoning content
                if (reasoningContent) {
                    this.thinkingBuffer += reasoningContent

                    yield new ChatGenerationChunk({
                        text: '',
                        message: new AIMessageChunk({
                            content: '',
                            additional_kwargs: {
                                thinking: this.thinkingBuffer,
                                isThinking: true,
                                reasoningType
                            }
                        })
                    })
                }

                // Yield regular content
                if (regularContent) {
                    yield new ChatGenerationChunk({
                        text: regularContent,
                        message: new AIMessageChunk({
                            content: regularContent,
                            additional_kwargs: {
                                thinking: this.thinkingBuffer || undefined,
                                isThinking: false,
                                reasoningType
                            }
                        })
                    })

                    await runManager?.handleLLMNewToken(regularContent)
                }

                // Handle finish
                if (choice?.finish_reason) {
                    yield new ChatGenerationChunk({
                        text: '',
                        message: new AIMessageChunk({
                            content: '',
                            additional_kwargs: {
                                finish_reason: choice.finish_reason,
                                thinking: this.thinkingBuffer || undefined,
                                reasoningType
                            }
                        })
                    })
                }
            }

            // Yield final metadata
            yield new ChatGenerationChunk({
                text: '',
                message: new AIMessageChunk({
                    content: '',
                    usage_metadata: usageMetadata,
                    additional_kwargs: {
                        finalThinking: this.thinkingBuffer || undefined,
                        reasoningType
                    }
                })
            })
        } catch (error) {
            console.error('Error in ChatOpenAI._streamResponseChunks:', error)
            // Fallback to parent implementation on error
            for await (const chunk of parentStream) {
                yield chunk
            }
        }
    }
}
