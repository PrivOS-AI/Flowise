import { createClient } from 'redis'
import { SSEStreamer } from '../utils/SSEStreamer'
import logger from '../utils/logger'

/**
 * SSE Event Types
 * Used for streaming events to clients via Server-Sent Events
 */
const SSEEventType = {
    START: 'start',
    TOKEN: 'token',
    SOURCE_DOCUMENTS: 'sourceDocuments',
    ARTIFACTS: 'artifacts',
    USED_TOOLS: 'usedTools',
    CALLED_TOOLS: 'calledTools',
    FILE_ANNOTATIONS: 'fileAnnotations',
    TOOL: 'tool',
    AGENT_REASONING: 'agentReasoning',
    NEXT_AGENT: 'nextAgent',
    AGENT_FLOW_EVENT: 'agentFlowEvent',
    AGENT_FLOW_EXECUTED_DATA: 'agentFlowExecutedData',
    NEXT_AGENT_FLOW: 'nextAgentFlow',
    ACTION: 'action',
    ABORT: 'abort',
    ERROR: 'error',
    METADATA: 'metadata',
    USAGE_METADATA: 'usageMetadata',
    TTS_START: 'tts_start',
    TTS_DATA: 'tts_data',
    TTS_END: 'tts_end',
    TTS_ABORT: 'tts_abort',
    THINKING: 'thinking',
    QUESTION: 'question',
    HEARTBEAT: 'heartbeat'
} as const

export class RedisEventSubscriber {
    private redisSubscriber: ReturnType<typeof createClient>
    private sseStreamer: SSEStreamer
    private subscribedChannels: Set<string> = new Set()

    constructor(sseStreamer: SSEStreamer) {
        if (process.env.REDIS_URL) {
            let socketOptions: any = {
                keepAlive:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            }

            // Handle TLS for rediss:// URLs
            if (process.env.REDIS_URL.startsWith('rediss://')) {
                socketOptions.tls = true
                socketOptions.rejectUnauthorized = false
            }

            this.redisSubscriber = createClient({
                url: process.env.REDIS_URL,
                socket: socketOptions,
                pingInterval:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            })
        } else {
            this.redisSubscriber = createClient({
                username: process.env.REDIS_USERNAME || undefined,
                password: process.env.REDIS_PASSWORD || undefined,
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    tls: process.env.REDIS_TLS === 'true',
                    cert: process.env.REDIS_CERT ? Buffer.from(process.env.REDIS_CERT, 'base64') : undefined,
                    key: process.env.REDIS_KEY ? Buffer.from(process.env.REDIS_KEY, 'base64') : undefined,
                    ca: process.env.REDIS_CA ? Buffer.from(process.env.REDIS_CA, 'base64') : undefined,
                    keepAlive:
                        process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                            ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                            : undefined
                },
                pingInterval:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            })
        }
        this.sseStreamer = sseStreamer

        this.setupEventListeners()
    }

    private setupEventListeners() {
        this.redisSubscriber.on('connect', () => {
            logger.info(`[RedisEventSubscriber] Redis client connecting...`)
        })

        this.redisSubscriber.on('ready', () => {
            logger.info(`[RedisEventSubscriber] Redis client ready and connected`)
        })

        this.redisSubscriber.on('error', (err) => {
            logger.error(`[RedisEventSubscriber] Redis client error:`, {
                error: err,
                isReady: this.redisSubscriber.isReady,
                isOpen: this.redisSubscriber.isOpen,
                subscribedChannelsCount: this.subscribedChannels.size
            })
        })

        this.redisSubscriber.on('end', () => {
            logger.warn(`[RedisEventSubscriber] Redis client connection ended`)
        })

        this.redisSubscriber.on('reconnecting', () => {
            logger.info(`[RedisEventSubscriber] Redis client reconnecting...`)
        })
    }

    async connect() {
        await this.redisSubscriber.connect()
    }

    subscribe(channel: string) {
        // Subscribe to the Redis channel for job events
        if (!this.redisSubscriber) {
            throw new Error('Redis subscriber not connected.')
        }

        // Check if already subscribed
        if (this.subscribedChannels.has(channel)) {
            return // Prevent duplicate subscription
        }

        this.redisSubscriber.subscribe(channel, (message) => {
            this.handleEvent(message)
        })

        // Mark the channel as subscribed
        this.subscribedChannels.add(channel)
    }

    private handleEvent(message: string) {
        // Parse the message from Redis
        const event = JSON.parse(message)
        const { eventType, chatId, chatMessageId, data } = event

        // Stream the event to the client
        switch (eventType) {
            case SSEEventType.START:
                this.sseStreamer.streamStartEvent(chatId, data)
                break
            case SSEEventType.TOKEN:
                this.sseStreamer.streamTokenEvent(chatId, data)
                break
            case SSEEventType.SOURCE_DOCUMENTS:
                this.sseStreamer.streamSourceDocumentsEvent(chatId, data)
                break
            case SSEEventType.ARTIFACTS:
                this.sseStreamer.streamArtifactsEvent(chatId, data)
                break
            case SSEEventType.USED_TOOLS:
                this.sseStreamer.streamUsedToolsEvent(chatId, data)
                break
            case SSEEventType.CALLED_TOOLS:
                this.sseStreamer.streamCalledToolsEvent(chatId, data)
                break
            case SSEEventType.FILE_ANNOTATIONS:
                this.sseStreamer.streamFileAnnotationsEvent(chatId, data)
                break
            case SSEEventType.TOOL:
                this.sseStreamer.streamToolEvent(chatId, data)
                break
            case SSEEventType.AGENT_REASONING:
                this.sseStreamer.streamAgentReasoningEvent(chatId, data)
                break
            case SSEEventType.NEXT_AGENT:
                this.sseStreamer.streamNextAgentEvent(chatId, data)
                break
            case SSEEventType.AGENT_FLOW_EVENT:
                this.sseStreamer.streamAgentFlowEvent(chatId, data)
                break
            case SSEEventType.AGENT_FLOW_EXECUTED_DATA:
                this.sseStreamer.streamAgentFlowExecutedDataEvent(chatId, data)
                break
            case SSEEventType.NEXT_AGENT_FLOW:
                this.sseStreamer.streamNextAgentFlowEvent(chatId, data)
                break
            case SSEEventType.ACTION:
                this.sseStreamer.streamActionEvent(chatId, data)
                break
            case SSEEventType.ABORT:
                this.sseStreamer.streamAbortEvent(chatId)
                break
            case SSEEventType.ERROR:
                this.sseStreamer.streamErrorEvent(chatId, data)
                break
            case SSEEventType.METADATA:
                this.sseStreamer.streamMetadataEvent(chatId, data)
                break
            case SSEEventType.USAGE_METADATA:
                this.sseStreamer.streamUsageMetadataEvent(chatId, data)
                break
            case SSEEventType.TTS_START:
                this.sseStreamer.streamTTSStartEvent(chatId, chatMessageId, data.format)
                break
            case SSEEventType.TTS_DATA:
                this.sseStreamer.streamTTSDataEvent(chatId, chatMessageId, data)
                break
            case SSEEventType.TTS_END:
                this.sseStreamer.streamTTSEndEvent(chatId, chatMessageId)
                break
            case SSEEventType.TTS_ABORT:
                this.sseStreamer.streamTTSAbortEvent(chatId, chatMessageId)
                break
            case SSEEventType.THINKING:
                this.sseStreamer.streamThinkingEvent(chatId, data)
                break
            case SSEEventType.QUESTION:
                this.sseStreamer.streamQuestionEvent(chatId, data)
                break
            case SSEEventType.HEARTBEAT:
                // Heartbeat events are handled by the controller's timer, not via Redis
                // This case exists for completeness but shouldn't be used
                break
        }
    }

    async disconnect() {
        if (this.redisSubscriber) {
            await this.redisSubscriber.quit()
        }
    }
}
