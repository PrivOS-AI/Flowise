/**
 * Agent Constants
 * Centralized constants for agent execution and error handling
 */

// Error Messages
export const AGENT_ERROR_MESSAGES = {
    INVALID_TOOL_INPUT: 'Invalid or incomplete tool input. Please try again.',
    INVALID_TOOL: (toolName: string) => `${toolName} is not a valid tool, try another one.`
} as const

// Prefix Constants for Agent Output
export const AGENT_OUTPUT_PREFIXES = {
    SOURCE_DOCUMENTS: '\n\n----FLOWISE_SOURCE_DOCUMENTS----\n\n',
    ARTIFACTS: '\n\n----FLOWISE_ARTIFACTS----\n\n',
    TOOL_ARGS: '\n\n----FLOWISE_TOOL_ARGS----\n\n'
} as const

// Re-export for backward compatibility with existing code
export const SOURCE_DOCUMENTS_PREFIX = AGENT_OUTPUT_PREFIXES.SOURCE_DOCUMENTS
export const ARTIFACTS_PREFIX = AGENT_OUTPUT_PREFIXES.ARTIFACTS
export const TOOL_ARGS_PREFIX = AGENT_OUTPUT_PREFIXES.TOOL_ARGS
