import { ChatOpenAI as LangchainChatOpenAI, ChatOpenAIFields } from '@langchain/openai'
import { IMultiModalOption, IVisionChatModal } from '../../../src'
import { BaseMessage, AIMessageChunk } from '@langchain/core/messages'
import { ChatGenerationChunk } from '@langchain/core/outputs'
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import OpenAI from 'openai'

export class ChatOpenAICustom extends LangchainChatOpenAI implements IVisionChatModal {
    configuredModel: string
    configuredMaxToken?: number
    multiModalOption: IMultiModalOption
    id: string
    private thinkingBuffer: string = ''
    private isInThinking: boolean = false
    // Store custom API configuration
    private customBaseURL?: string
    private customDefaultHeaders?: any

    constructor(id: string, fields?: ChatOpenAIFields) {
        super(fields)
        this.id = id
        this.configuredModel = fields?.model ?? ''
        this.configuredMaxToken = fields?.maxTokens
        // Store configuration for our custom streaming
        const config = (fields as any)?.configuration
        if (config) {
            this.customBaseURL = config.baseURL
            this.customDefaultHeaders = config.defaultHeaders
        }
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

    /**
     * Override _streamResponseChunks to handle reasoning field from OpenAI-compatible APIs
     * Similar to FlowiseChatOllama which handles responseMessage.thinking
     */
    async *_streamResponseChunks(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): AsyncGenerator<ChatGenerationChunk> {
        // Reset thinking state
        this.thinkingBuffer = ''
        this.isInThinking = false

        // Call parent stream as fallback
        const parentStream = super._streamResponseChunks(messages, options, runManager)

        try {
            // Create OpenAI client from stored configuration
            const client = new OpenAI({
                apiKey: this.apiKey || '',
                baseURL: this.customBaseURL,
                defaultHeaders: this.customDefaultHeaders,
                timeout: this.timeout ?? 4000 * 60,
                maxRetries: 0
            })

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
            const openaiMessages = this.convertMessagesToOpenAI(messages)

            const stream = (await client.chat.completions.create({
                ...params,
                messages: openaiMessages
            })) as any

            let lastMetadata: any = {}
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
                if (!choice) continue

                const delta = choice.delta
                const { delta: _, ...rest } = choice

                // Update usage metadata
                if (chunk.usage) {
                    usageMetadata.input_tokens = chunk.usage.prompt_tokens || 0
                    usageMetadata.output_tokens = chunk.usage.completion_tokens || 0
                    usageMetadata.total_tokens = chunk.usage.total_tokens || 0
                }
                lastMetadata = rest

                // Handle reasoning field (gpt-oss uses delta.reasoning, DeepSeek uses reasoning_content)
                const reasoningContent = delta?.reasoning || delta?.reasoning_content
                if (reasoningContent) {
                    if (!this.isInThinking) {
                        this.isInThinking = true
                        this.thinkingBuffer = ''
                    }
                    this.thinkingBuffer += reasoningContent

                    // Yield thinking content in additional_kwargs
                    yield new ChatGenerationChunk({
                        text: '',
                        message: new AIMessageChunk({
                            content: '',
                            additional_kwargs: {
                                thinking: this.thinkingBuffer,
                                isThinking: true
                            }
                        })
                    })
                }

                // Handle regular content
                if (delta?.content) {
                    yield new ChatGenerationChunk({
                        text: delta.content,
                        message: new AIMessageChunk({
                            content: delta.content,
                            additional_kwargs: {
                                thinking: this.thinkingBuffer || undefined,
                                isThinking: false
                            }
                        })
                    })

                    await runManager?.handleLLMNewToken(delta.content)
                }

                // Handle finish
                if (choice?.finish_reason) {
                    yield new ChatGenerationChunk({
                        text: '',
                        message: new AIMessageChunk({
                            content: '',
                            additional_kwargs: {
                                finish_reason: choice.finish_reason,
                                thinking: this.thinkingBuffer || undefined
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
                    response_metadata: lastMetadata,
                    usage_metadata: usageMetadata
                })
            })
        } catch (error) {
            console.error('Error in ChatOpenAICustom._streamResponseChunks:', error)
            // Fallback to parent implementation on error
            for await (const chunk of parentStream) {
                yield chunk
            }
        }
    }

    /**
     * Helper to convert LangChain messages to OpenAI format
     */
    private convertMessagesToOpenAI(messages: BaseMessage[]): any[] {
        return messages.flatMap((msg) => {
            const type = msg._getType()

            if (type === 'human' || type === 'generic') {
                if (typeof msg.content === 'string') {
                    return [{ role: 'user', content: msg.content }]
                }
                // Handle complex content (images, etc.)
                return (msg.content as any).map((c: any) => {
                    if (c.type === 'text') {
                        return { role: 'user', content: c.text }
                    } else if (c.type === 'image_url') {
                        return {
                            role: 'user',
                            content: typeof c.image_url === 'string' ? c.image_url : c.image_url.url
                        }
                    }
                    return { role: 'user', content: '' }
                })
            } else if (type === 'ai') {
                if (typeof msg.content === 'string') {
                    return [{ role: 'assistant', content: msg.content }]
                }
                // Handle AI messages with tool calls, etc.
                return (msg.content as any)
                    .map((c: any) => {
                        if (c.type === 'text') {
                            return { role: 'assistant', content: c.text }
                        }
                        return null
                    })
                    .filter(Boolean)
            } else if (type === 'system') {
                if (typeof msg.content === 'string') {
                    return [{ role: 'system', content: msg.content }]
                }
                return (msg.content as any).map((c: any) => ({
                    role: 'system',
                    content: c.text
                }))
            } else if (type === 'tool') {
                return [{ role: 'tool', content: msg.content as string }]
            }

            throw new Error(`Unsupported message type: ${type}`)
        })
    }
}
