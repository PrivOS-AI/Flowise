/**
 * PrivOS Utility Functions
 * Helper functions for PrivOS integration
 */

import FormData from 'form-data'
import { secureAxiosRequest } from '../../src/httpSecurity'
import { PRIVOS_ENDPOINTS, PRIVOS_HEADERS, ERROR_MESSAGES } from './constants'
import { ICommonObject, INodeData } from '../../src'
import { CRON_TEMPLATES, INTERVAL_MS, SCHEDULE_DEFAULTS, SCHEDULE_TYPES } from './trigger-node/constant'

// MIME type mapping for file extensions
export const MIME_TYPE_MAP: { [key: string]: string } = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.sql': 'application/sql',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
}

/**
 * Get MIME type from filename extension
 * @param filename - The filename to extract extension from
 * @returns MIME type string or null if not found
 */
export function getMimeTypeFromFilename(filename: string): string | null {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
    return MIME_TYPE_MAP[ext] || null
}

/**
 * Upload a file to Privos server
 * @param fileBuffer - File buffer data
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file
 * @param baseUrl - Privos API base URL
 * @param userId - User ID for authentication
 * @param authToken - Auth token for authentication
 * @returns File object with _id, name, size, type, url, uploadedAt
 */
export async function uploadFileToPrivos(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    baseUrl: string,
    userId: string,
    authToken: string
): Promise<{ _id: string; name: string; size: number; type: string; url: string; uploadedAt: string }> {
    const formData = new FormData()
    formData.append('file', fileBuffer, {
        filename: filename,
        contentType: mimeType
    })

    const apiUrl = `${baseUrl}${PRIVOS_ENDPOINTS.FILES_UPLOAD}`

    const response = await secureAxiosRequest({
        method: 'POST',
        url: apiUrl,
        headers: {
            ...formData.getHeaders(),
            [PRIVOS_HEADERS.USER_ID]: userId,
            [PRIVOS_HEADERS.AUTH_TOKEN]: authToken
        },
        data: formData
    })

    if (!response.data?.file) {
        throw new Error(ERROR_MESSAGES.UPLOAD_FAILED('No file data in response'))
    }

    return response.data.file
}

/*
 * Build a map of field definitions from list info data
 * @param listInfoData - List info data containing field definitions
 * @returns Map of field definitions keyed by field ID
 */
export function buildFieldDefinitionMap(listInfoData: any = {}) {
    const fieldDefs = listInfoData.list?.fieldDefinitions ?? []
    return fieldDefs.reduce((acc: any, { _id, name, type, options }: any) => {
        acc[_id] = {
            name,
            type,
            options: options ?? []
        }
        return acc
    }, {})
}

/*
 * Map custom fields from item info data with definitions from list info data
 * @param itemInfoData - Item info data containing custom fields
 * @param listInfoData - List info data containing field definitions
 * @returns Array of mapped custom fields with definitions
 */
export function mapCustomFields(itemInfoData: any = {}, listInfoData: any = {}) {
    const item = itemInfoData.item
    if (!item || !Array.isArray(item.customFields)) return []

    const fieldDefMap = buildFieldDefinitionMap(listInfoData)

    return item.customFields.map(({ fieldId, value }: any) => {
        const def = fieldDefMap[fieldId]
        return {
            fieldId,
            name: def?.name ?? null,
            type: def?.type ?? null,
            options: def?.options ?? [],
            value
        }
    })
}

export function extractTextFromHtml(html: string): string {
    if (!html) return ''
    const htmlStrip = html
        ?.toString()
        .replace(/<[^>]*>/g, '')
        .trim()
    return htmlStrip
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
}

export const PrivosErrorHandler = {
    /**
     * Wrap error into standardized output format
     */
    wrapError: (nodeName: string, error: any, nodeId: string, state?: ICommonObject) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Internal Error'

        console.error(`[${nodeName}][ID: ${nodeId}] Execution Failed:`, error)

        return {
            id: nodeId,
            name: nodeName,
            state: state || {},
            output: {
                success: false,
                content: `🚨 [${nodeName}] Error: ${errorMessage}`,
                error: true,
                rawError: error
            }
        }
    }
}

export const parseMultiSelectFields = (selectedFields: any): string[] => {
    if (!selectedFields) return []
    let parsed: any[] = []

    try {
        parsed = typeof selectedFields === 'string' ? JSON.parse(selectedFields) : selectedFields
    } catch {
        parsed = [selectedFields]
    }

    const flattened: string[] = []
    parsed.forEach((item) => {
        try {
            const innerParsed = typeof item === 'string' ? JSON.parse(item) : item
            Array.isArray(innerParsed) ? flattened.push(...innerParsed) : flattened.push(String(item))
        } catch {
            flattened.push(String(item))
        }
    })
    return flattened
}

/**
 * Calculate delay for one-time execution (ONCE type)
 * @param executeAt - ISO string or timestamp
 * @returns Milliseconds until execution
 */
export function calculateOnceDelay(executeAt: string | Date): number {
    const targetTime = new Date(executeAt).getTime()
    const now = Date.now()
    const delay = targetTime - now

    if (delay < 0) {
        throw new Error('Execution time must be in the future')
    }

    return delay
}

interface BullMQRepeatOptions {
    pattern?: string // Cron pattern
    every?: number // Milliseconds
    limit?: number // Max executions
    immediately?: boolean // Start immediately
    endDate?: Date | string | number // When to stop
    tz?: string // Timezone
}

/**
 * Get full job options including retry config
 *
 * @param config - Parsed config from node inputs
 * @param bullMQRepeat - BullMQ repeat options
 * @returns Complete job options for BullMQ (already includes repeat inside)
 */
export function getBullMQJobOptions(config: ICommonObject, bullMQRepeat?: BullMQRepeatOptions): ICommonObject {
    const jobOptions: ICommonObject = {}

    // Add repeat config if exists (this is the "repeat" option you remember!)
    if (bullMQRepeat && Object.keys(bullMQRepeat).length > 0) {
        jobOptions.repeat = bullMQRepeat
    }

    // Handle one-time execution
    if (config.scheduleType === SCHEDULE_TYPES.ONCE && config.executeAt) {
        jobOptions.delay = calculateOnceDelay(config.executeAt)
    }

    // Retry configuration
    if (config.retryOnFail) {
        jobOptions.attempts = config.attempts || SCHEDULE_DEFAULTS.RETRY_ATTEMPTS
        jobOptions.backoff = {
            type: config.type || 'fixed',
            delay: config.backoff || SCHEDULE_DEFAULTS.RETRY_DELAY
        }
    }

    // Remove old jobs on restart
    jobOptions.removeOnComplete = true
    jobOptions.removeOnFail = false

    return jobOptions
}

/**
 * Parse and validate schedule configuration
 */
export function parseConfig(nodeData: INodeData): ICommonObject {
    const inputs = nodeData.inputs || {}
    const scheduleType = inputs.scheduleType as string

    const config: ICommonObject = {
        scheduleType,
        enabled: inputs.isEnabled ?? true,
        maxExecutions: inputs.maxExecutions ?? -1,
        retryOnFail: inputs.retryOnFail ?? false,
        attempts: inputs.attempts ?? 3,
        backoff: inputs.backoff ?? 3000
    }

    // Type-specific config
    switch (scheduleType) {
        case SCHEDULE_TYPES.INTERVAL:
            config.interval = inputs.interval ?? 5
            config.intervalUnit = inputs.intervalUnit ?? 'minutes'
            break

        case SCHEDULE_TYPES.CRON:
            // Use custom pattern or template
            config.cronPattern = inputs.cronPattern || getCronFromTemplate(inputs.cronTemplate) || SCHEDULE_DEFAULTS.CRON
            break

        case SCHEDULE_TYPES.ONCE:
            config.executeAt = inputs.executeAt
            break

        case SCHEDULE_TYPES.DAILY:
            config.time = getTimeFromArray(inputs.executionTime)
            config.timezone = inputs.timezone || 'UTC'
            break

        case SCHEDULE_TYPES.WEEKLY:
            config.days = inputs.weeklyDays || ['1']
            config.time = getTimeFromArray(inputs.executionTime)
            config.timezone = inputs.timezone || 'UTC'
            break

        case SCHEDULE_TYPES.MONTHLY:
            config.days = parseCommaSeparated(inputs.monthlyDays) || [1]
            config.time = getTimeFromArray(inputs.executionTime)
            config.timezone = inputs.timezone || 'UTC'
            break
    }

    return config
}

/**
 * Extract time from array format (hour, minute)
 */
export function getTimeFromArray(timeArray: any): string {
    if (!timeArray || !Array.isArray(timeArray) || timeArray.length === 0) {
        return SCHEDULE_DEFAULTS.TIME
    }
    const timeObj = timeArray[0]
    const h = timeObj?.hour !== undefined ? parseInt(timeObj.hour.toString(), 10) : 9
    const m = timeObj?.minute !== undefined ? parseInt(timeObj.minute.toString(), 10) : 0
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Get cron pattern from template name
 */
function getCronFromTemplate(templateName: string | undefined): string | undefined {
    if (!templateName) return undefined
    const template = CRON_TEMPLATES.find((t) => t.name === templateName)
    return template?.cronExpression
}

/**
 * Parse comma-separated string to array of strings or numbers
 */
function parseCommaSeparated(value: string | undefined): any[] | undefined {
    if (!value) return undefined
    return value
        .split(',')
        .map((s) => {
            const trimmed = s.trim()
            const num = Number(trimmed)
            return isNaN(num) ? trimmed : num
        })
        .filter((v) => v !== '')
}

export function convertToBullMQConfig(config: ICommonObject): BullMQRepeatOptions {
    const scheduleType = config.scheduleType as string
    const bullMQConfig: BullMQRepeatOptions = {}

    // Max executions
    if (config.maxExecutions && config.maxExecutions > 0) {
        bullMQConfig.limit = config.maxExecutions
    }

    // Convert based on schedule type
    switch (scheduleType) {
        case SCHEDULE_TYPES.INTERVAL:
            bullMQConfig.every = convertIntervalToMs(config.interval, config.intervalUnit)
            break

        case SCHEDULE_TYPES.CRON:
            bullMQConfig.pattern = config.cronPattern || SCHEDULE_DEFAULTS.CRON
            bullMQConfig.tz = 'UTC'
            break

        case SCHEDULE_TYPES.ONCE:
            // For one-time execution, don't use repeat - handle differently
            // Return empty config and use delay instead in job options
            return {}

        case SCHEDULE_TYPES.DAILY:
            bullMQConfig.pattern = convertToCron(config.time, '*', '*', '*')
            bullMQConfig.tz = config.timezone || 'UTC'
            break

        case SCHEDULE_TYPES.WEEKLY:
            bullMQConfig.pattern = convertToCron(config.time, '*', '*', formatDaysOfWeek(config.days))
            bullMQConfig.tz = config.timezone || 'UTC'
            break

        case SCHEDULE_TYPES.MONTHLY:
            bullMQConfig.pattern = convertToCron(config.time, formatDaysOfMonth(config.days), '*', '*')
            bullMQConfig.tz = config.timezone || 'UTC'
            break

        default:
            throw new Error(`Unknown schedule type: ${scheduleType}`)
    }

    return bullMQConfig
}

/**
 * Convert interval to milliseconds
 */
function convertIntervalToMs(interval: number, unit: string): number {
    const multiplier = INTERVAL_MS[unit] || INTERVAL_MS.minutes
    return interval * multiplier
}

/**
 * Convert time (HH:MM) to cron pattern
 * @param time - Time in HH:MM format
 * @param day - Day of month (* or specific)
 * @param month - Month (* or specific)
 * @param dayOfWeek - Day of week (* or specific)
 * @returns Cron pattern string
 */
function convertToCron(time: string, day: string, month: string, dayOfWeek: string): string {
    if (!time) {
        time = SCHEDULE_DEFAULTS.TIME
    }
    const [hour, minute] = time.split(':').map((s) => parseInt(s, 10))
    return `${minute} ${hour} ${day} ${month} ${dayOfWeek}`
}

/**
 * Format days of week for cron (array to comma-separated)
 */
function formatDaysOfWeek(days: string[] | number[]): string {
    if (!days || days.length === 0) return '*'
    return days.join(',')
}

/**
 * Format days of month for cron (array to comma-separated)
 */
function formatDaysOfMonth(days: string[] | number[]): string {
    if (!days || days.length === 0) return '*'
    return days.join(',')
}
