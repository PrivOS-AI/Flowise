import axios, { AxiosInstance } from 'axios'
import logger from '../utils/logger'
import { SECURITY_CONFIG, checkRateLimit, sanitizeString, validateFieldId, validateFieldValue, validateEmail } from './constant'

interface CustomField {
    fieldId: string
    value: any
}

interface CreateItemRequest {
    name: string
    description?: string
    listId: string
    stageId: string
    customFields?: CustomField[]
}

interface CreateItemResponse {
    success: boolean
    data?: {
        _id: string
        name: string
        listId: string
        stageId: string
        customFields?: any[]
    }
    error?: string
    message?: string
}

export class PrivosBoardService {
    private axiosInstance: AxiosInstance
    private baseUrl: string

    constructor(apiKey: string = '', userId: string = '', baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.PRIVOS_CHAT_URL || 'https://privos.roxane.one/api/v1'

        // Build headers - use x-api-key for Privos API authentication
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }

        if (apiKey) {
            headers['x-api-key'] = apiKey
        }

        // Legacy support for X-User-Id/X-Auth-Token (if provided)
        if (userId) {
            headers['X-User-Id'] = userId
        }

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers
        })

        logger.info(`[PrivosBoardService]: Initialized with baseUrl: ${this.baseUrl}, hasApiKey: ${!!apiKey}`)
    }

    /**
     * Create a new item in Privos board
     *
     * @param request - Item creation request
     * @returns Created item data
     */
    async createItem(request: CreateItemRequest): Promise<CreateItemResponse> {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        try {
            // SECURITY: Rate limiting check
            // Use API key or IP address as rate limit key
            const apiKeyHeader = this.axiosInstance.defaults.headers['x-api-key']
            const rateLimitKey = (typeof apiKeyHeader === 'string' ? apiKeyHeader : '') || 'anonymous'
            try {
                checkRateLimit(rateLimitKey)
            } catch (rateError: any) {
                logger.warn(`[PrivosBoardService][${requestId}]: Rate limit exceeded: ${rateError.message}`)
                return {
                    success: false,
                    error: 'Rate limit exceeded',
                    message: rateError.message
                }
            }

            // SECURITY: Validate and sanitize inputs
            if (!request.name || request.name.trim().length === 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    message: 'Name is required'
                }
            }

            if (!request.listId || request.listId.trim().length === 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    message: 'List ID is required'
                }
            }

            if (!request.stageId || request.stageId.trim().length === 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    message: 'Stage ID is required'
                }
            }

            logger.info(`[PrivosBoardService][${requestId}]: Creating item...`)
            logger.info(`[PrivosBoardService][${requestId}]: Name: ${request.name}`)
            logger.info(`[PrivosBoardService][${requestId}]: List ID: ${request.listId}`)
            logger.info(`[PrivosBoardService][${requestId}]: Stage ID: ${request.stageId}`)

            // Prepare request body with sanitized inputs
            const requestBody: any = {
                name: sanitizeString(request.name, SECURITY_CONFIG.MAX_LENGTH.name),
                listId: sanitizeString(request.listId, SECURITY_CONFIG.MAX_LENGTH.fieldId),
                stageId: sanitizeString(request.stageId, SECURITY_CONFIG.MAX_LENGTH.fieldId)
            }

            // Add description if provided (sanitized)
            if (request.description) {
                requestBody.description = sanitizeString(request.description, SECURITY_CONFIG.MAX_LENGTH.description)
            }

            // Add custom fields if provided (validate and sanitize)
            if (request.customFields && request.customFields.length > 0) {
                const sanitizedCustomFields = request.customFields
                    .filter((field) => {
                        // Validate field ID
                        if (!field.fieldId || !validateFieldId(field.fieldId)) {
                            logger.warn(`[PrivosBoardService][${requestId}]: Invalid field ID: ${field.fieldId}`)
                            return false
                        }
                        return true
                    })
                    .map((field) => ({
                        fieldId: sanitizeString(field.fieldId, SECURITY_CONFIG.MAX_LENGTH.fieldId),
                        value: validateFieldValue(field.value)
                    }))

                if (sanitizedCustomFields.length > 0) {
                    requestBody.customFields = sanitizedCustomFields
                }
            }

            logger.info(`[PrivosBoardService][${requestId}]: Request body: ${JSON.stringify(requestBody)}`)

            // Make API call - Use internal endpoint with x-api-key
            const response = await this.axiosInstance.post('/internal/items.create', requestBody)

            logger.info(`[PrivosBoardService][${requestId}]: Success! Status: ${response.status}`)

            // Extract item from response based on API documentation
            const item = response.data?.data?.item || response.data?.item

            return {
                success: true,
                data: item
            }
        } catch (error: any) {
            logger.error(`[PrivosBoardService][${requestId}]: ❌ Failed to create item`)
            logger.error(`[PrivosBoardService][${requestId}]: Error: ${error.message}`)
            logger.error(
                `[PrivosBoardService][${requestId}]: Details: ${JSON.stringify({
                    message: error.message,
                    code: error.code,
                    response: error.response?.data,
                    status: error.response?.status
                })}`
            )

            return {
                success: false,
                error: error.message,
                message: error.response?.data?.message || 'Failed to create item in Privos board'
            }
        }
    }

    /**
     * Map webhook payload to Privos item request with security validation
     *
     * @param payload - Webhook payload from form
     * @returns CreateItemRequest
     */
    static mapWebhookPayloadToItemRequest(payload: any): CreateItemRequest {
        // SECURITY: Validate payload is an object
        if (!payload || typeof payload !== 'object') {
            logger.warn('[PrivosBoardService]: Invalid payload type')
            throw new Error('Invalid payload: must be an object')
        }

        // Extract user input data with safe defaults
        const name = payload.name || 'Unknown'
        const email = payload.email
        const phoneNumber = payload.phone_number || payload.phone
        const message = payload.message
        const source = payload.source || 'webhook'

        // SECURITY: Validate required fields
        const listId = payload.listId
        const stageId = payload.stageId

        if (!listId || typeof listId !== 'string') {
            logger.warn('[PrivosBoardService]: Missing or invalid listId')
            throw new Error('listId is required and must be a string')
        }

        if (!stageId || typeof stageId !== 'string') {
            logger.warn('[PrivosBoardService]: Missing or invalid stageId')
            throw new Error('stageId is required and must be a string')
        }

        // SECURITY: Sanitize email format
        if (email && typeof email === 'string') {
            if (!validateEmail(email)) {
                logger.warn('[PrivosBoardService]: Invalid email format')
                throw new Error('Invalid email format')
            }
        }

        // Build description from available fields
        const descriptionParts: string[] = []

        if (email) {
            descriptionParts.push(`Email: ${email}`)
        }

        if (phoneNumber) {
            descriptionParts.push(`Phone: ${phoneNumber}`)
        }

        if (message) {
            descriptionParts.push(`Message: ${message}`)
        }

        if (source) {
            descriptionParts.push(`Source: ${source}`)
        }

        const description = descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined

        // Build custom fields from payload
        const customFields: CustomField[] = []
        const customFieldIds = payload.customFieldIds || {}

        // SECURITY: Validate customFieldIds is an object
        if (customFieldIds && typeof customFieldIds !== 'object') {
            logger.warn('[PrivosBoardService]: Invalid customFieldIds type, ignoring')
        } else {
            // Standard field mappings (backward compatibility)
            const standardMappings: Record<string, any> = {
                email,
                phone: phoneNumber,
                name,
                message,
                source
            }

            // Process standard fields first
            for (const [fieldKey, fieldValue] of Object.entries(standardMappings)) {
                if (fieldValue && customFieldIds[fieldKey]) {
                    const fieldId = customFieldIds[fieldKey]

                    // SECURITY: Validate field ID format
                    if (validateFieldId(fieldId)) {
                        customFields.push({
                            fieldId,
                            value: fieldValue
                        })
                    } else {
                        logger.warn(`[PrivosBoardService]: Invalid field ID for ${fieldKey}: ${fieldId}`)
                    }
                }
            }

            const reservedKeys = [
                'name',
                'email',
                'phone_number',
                'phone',
                'message',
                'source',
                'listId',
                'stageId',
                'roomId',
                'privosApiKey',
                'customFieldIds'
            ]

            // SECURITY: Limit number of custom fields to prevent abuse
            let customFieldCount = 0
            const MAX_CUSTOM_FIELDS = 50

            for (const [key, value] of Object.entries(payload)) {
                // Skip reserved keys
                if (reservedKeys.includes(key)) {
                    continue
                }

                // SECURITY: Prevent custom field overflow
                if (customFieldCount >= MAX_CUSTOM_FIELDS) {
                    logger.warn(`[PrivosBoardService]: Exceeded max custom fields (${MAX_CUSTOM_FIELDS}), skipping remaining`)
                    break
                }

                // If this key has a custom field ID mapping AND has a value
                if (customFieldIds[key] && value !== undefined && value !== null && value !== '') {
                    const fieldId = customFieldIds[key]

                    if (validateFieldId(fieldId)) {
                        customFields.push({
                            fieldId,
                            value: value
                        })
                        customFieldCount++
                    } else {
                        logger.warn(`[PrivosBoardService]: Invalid field ID for ${key}: ${fieldId}`)
                    }
                }
            }
        }

        return {
            name,
            description,
            listId,
            stageId,
            customFields: customFields.length > 0 ? customFields : undefined
        }
    }
}

export default PrivosBoardService
