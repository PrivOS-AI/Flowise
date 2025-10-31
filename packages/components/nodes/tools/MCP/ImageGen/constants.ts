/**
 * MCP Image Generation Constants
 *
 * Environment variables (infrastructure only):
 * - COMFYUI_ENDPOINT: ComfyUI server endpoint (optional, only if using self-hosted ComfyUI)
 *
 * All other settings (provider, models, parameters) are configured in UI node settings
 */

// PROVIDER CONFIGURATION

export const PROVIDERS = {
    GOOGLE: 'google',
    COMFYUI: 'comfyui'
} as const

export const PROVIDER_LABELS = {
    [PROVIDERS.GOOGLE]: 'Paid API (Google)',
    [PROVIDERS.COMFYUI]: 'Self-Hosted (ComfyUI)'
} as const

// MODEL DEFINITIONS

export const GOOGLE_MODELS = {
    GEMINI_2_0_FLASH_PREVIEW: 'gemini-2.0-flash-preview-image-generation',
    GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
    GEMINI_2_0_FLASH_IMAGE: 'gemini-2.0-flash-image',
    IMAGEN_3_0: 'imagen-3.0-generate-001',
    IMAGEN_4_0_FAST: 'imagen-4.0-fast-generate-001',
    IMAGEN_4_0: 'imagen-4.0-generate-001',
    IMAGEN_4_0_ULTRA: 'imagen-4.0-ultra-generate-001'
} as const

export const COMFYUI_MODELS = {
    FLUX_SCHNELL_FP8: 'flux1-schnell-fp8.safetensors',
    FLUX_DEV_FP8: 'flux1-dev-fp8.safetensors',
    SD_XL_BASE: 'sd_xl_base_1.0.safetensors',
    SD_1_5: 'v1-5-pruned-emaonly.safetensors',
    CUSTOM: 'custom'
} as const

// CREDENTIALS

export const CREDENTIALS = {
    GOOGLE_GENERATIVE_AI: 'googleGenerativeAI',
    GOOGLE_API_KEY_PARAM: 'googleGenerativeAPIKey'
} as const

// ENVIRONMENT VARIABLES (Read once at startup)
// Note: Only infrastructure settings (COMFYUI_ENDPOINT) should be in .env
// All other configs (provider, models, parameters) are set in UI node settings

const COMFYUI_ENDPOINT_VAR = process.env.COMFYUI_ENDPOINT || 'http://localhost:8188'

export const DEFAULTS = {
    PROVIDER: PROVIDERS.GOOGLE,
    GOOGLE_MODEL: GOOGLE_MODELS.GEMINI_2_0_FLASH_PREVIEW,
    COMFYUI_ENDPOINT: COMFYUI_ENDPOINT_VAR,
    COMFYUI_MODEL: COMFYUI_MODELS.FLUX_SCHNELL_FP8,
    IMAGE_SIZE: '480',
    STEPS: '20',
    GUIDANCE: '3.5'
} as const

// DOCUMENTATION

export const DOCUMENTATION_URL = 'https://docs.anthropic.com/en/docs/build-with-claude/mcp'

// ERROR MESSAGES

export const ERROR_MESSAGES = {
    NO_API_KEY: 'Google AI API key is required for Paid API provider',
    NO_ACTIONS: 'No available actions, please check your Google AI API key and refresh',
    UNKNOWN_PROVIDER: (provider: string) => `Unknown provider: ${provider}`,
    CUSTOM_MODEL_FILENAME_REQUIRED: 'Custom model filename is required when using Custom Model option'
} as const

// SERVER CONFIGURATION

export const SERVER_FILES = {
    GOOGLE: 'image-gen-server.mjs',
    COMFYUI: 'flux-gen-server.mjs'
} as const

export const ENV_VARS = {
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    DEFAULT_MODEL: 'DEFAULT_MODEL',
    COMFYUI_ENDPOINT: 'COMFYUI_ENDPOINT',
    MODEL: 'MODEL',
    IMAGE_SIZE: 'IMAGE_SIZE',
    STEPS: 'STEPS',
    GUIDANCE: 'GUIDANCE'
} as const

export const TRANSPORT_TYPE = 'stdio' as const
export const BASE_CLASS = 'Tool' as const
