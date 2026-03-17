import axios, { AxiosInstance } from 'axios'
import logger from '../utils/logger'

/**
 * PRIVOS BOARD SERVICE
 *
 * Service for creating items in Privos boards
 * Reference: privos-manager skill
 */

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
        this.baseUrl = baseUrl || process.env.PRIVOS_CHAT_URL || process.env.PRIVOS_API_BASE_URL || 'https://privos.roxane.one/api/v1'

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
            headers,
            timeout: 30000
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
            logger.info(`[PrivosBoardService][${requestId}]: Creating item...`)
            logger.info(`[PrivosBoardService][${requestId}]: Name: ${request.name}`)
            logger.info(`[PrivosBoardService][${requestId}]: List ID: ${request.listId}`)
            logger.info(`[PrivosBoardService][${requestId}]: Stage ID: ${request.stageId}`)

            // Prepare request body
            const requestBody: any = {
                name: request.name,
                listId: request.listId,
                stageId: request.stageId
            }

            // Add description if provided
            if (request.description) {
                requestBody.description = request.description
            }

            // Add custom fields if provided
            if (request.customFields && request.customFields.length > 0) {
                requestBody.customFields = request.customFields
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
     * Map webhook payload to Privos item request
     *
     * @param payload - Webhook payload from form
     * @returns CreateItemRequest
     */
    static mapWebhookPayloadToItemRequest(payload: any): CreateItemRequest {
        // Extract user input data
        const name = payload.name || 'Unknown'
        const email = payload.email
        const phoneNumber = payload.phone_number || payload.phone
        const message = payload.message
        const source = payload.source || 'webhook'

        // Extract routing information
        const listId = payload.listId
        const stageId = payload.stageId

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

        // Map email
        if (email && customFieldIds.email) {
            customFields.push({
                fieldId: customFieldIds.email,
                value: email
            })
        }

        // Map phone
        if (phoneNumber && customFieldIds.phone) {
            customFields.push({
                fieldId: customFieldIds.phone,
                value: phoneNumber
            })
        }

        // Map name
        if (name && customFieldIds.name) {
            customFields.push({
                fieldId: customFieldIds.name,
                value: name
            })
        }

        // Map message
        if (message && customFieldIds.message) {
            customFields.push({
                fieldId: customFieldIds.message,
                value: message
            })
        }

        // Map source
        if (source && customFieldIds.source) {
            customFields.push({
                fieldId: customFieldIds.source,
                value: source
            })
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
