/**
 * MCP Video Generation Constants
 *
 * Model selection is configured in UI node settings
 * No environment variables required for video generation
 */

// MODEL DEFINITIONS

export const VIDEO_MODELS = {
    VEO_2_0: 'veo-2.0-generate-001'
} as const

// CREDENTIALS

export const CREDENTIALS = {
    GOOGLE_GENERATIVE_AI: 'googleGenerativeAI',
    GOOGLE_API_KEY_PARAM: 'googleGenerativeAPIKey'
} as const

// ENVIRONMENT VARIABLES (Read once at startup)
// Note: Model selection is configured in UI node settings, not in .env

export const DEFAULTS = {
    MODEL: VIDEO_MODELS.VEO_2_0
} as const

// DOCUMENTATION

export const DOCUMENTATION_URL = 'https://ai.google.dev/gemini-api/docs/veo'

// ERROR MESSAGES
export const ERROR_MESSAGES = {
    NO_API_KEY: 'No Google AI API key provided',
    NO_ACTIONS: 'No available actions, please check your Google AI API key and refresh',
    UNKNOWN_ERROR: 'Unknown error loading video generation tools'
} as const

// SERVER CONFIGURATION

export const SERVER_FILES = {
    VIDEOGEN: 'video-gen-server.js'
} as const

export const ENV_VARS = {
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    DEFAULT_MODEL: 'DEFAULT_MODEL'
} as const

export const TRANSPORT_TYPE = 'stdio' as const
export const BASE_CLASS = 'Tool' as const
