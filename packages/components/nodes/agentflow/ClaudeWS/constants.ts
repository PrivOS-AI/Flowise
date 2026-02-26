// ==================== Time Constants ====================

/**
 * Default timeout for socket connections and attempts (15 minutes)
 */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Interval for periodic cleanup of expired data (1 minute)
 */
export const CLEANUP_INTERVAL_MS = 60 * 1000

// ==================== Event Type Constants ====================

/**
 * SSE Event Types
 * Used for streaming events to clients via Server-Sent Events
 */
export const SSEEventTypes = {
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

export type SSEEventType = (typeof SSEEventTypes)[keyof typeof SSEEventTypes]

// ==================== Socket Event Constants ====================

export const ClaudeWSOutputEventTypes = {
    CONTENT_BLOCK_DELTA: 'content_block_delta',
    ASSISTANT: 'assistant',
    TOOL_USE: 'tool_use',
    USER: 'user'
} as const

export type ClaudeWSOutputEventType = (typeof ClaudeWSOutputEventTypes)[keyof typeof ClaudeWSOutputEventTypes]

/**
 * ClaudeWS Delta Types (within content_block_delta)
 */
export const ClaudeWSDeltaTypes = {
    TEXT_DELTA: 'text_delta',
    THINKING_DELTA: 'thinking_delta'
} as const

export type ClaudeWSDeltaType = (typeof ClaudeWSDeltaTypes)[keyof typeof ClaudeWSDeltaTypes]

/**
 * ClaudeWS Content Block Types (within assistant message content)
 */
export const ClaudeWSContentBlockTypes = {
    TEXT: 'text',
    TOOL_USE: 'tool_use',
    TOOL_RESULT: 'tool_result'
} as const

export type ClaudeWSContentBlockType = (typeof ClaudeWSContentBlockTypes)[keyof typeof ClaudeWSContentBlockTypes]

// ==================== Socket Event Names ====================

/**
 * Socket.io Event Names for ClaudeWS communication
 */
export const SocketEventNames = {
    // Client to Server
    ATTEMPT_START: 'attempt:start',
    ATTEMPT_SUBSCRIBE: 'attempt:subscribe',

    // Server to Client
    ATTEMPT_STARTED: 'attempt:started',
    ATTEMPT_FINISHED: 'attempt:finished',
    OUTPUT_JSON: 'output:json',
    QUESTION_ASK: 'question:ask',
    CONNECT: 'connect',
    CONNECT_ERROR: 'connect_error',
    ERROR: 'error'
} as const

export type SocketEventName = (typeof SocketEventNames)[keyof typeof SocketEventNames]
