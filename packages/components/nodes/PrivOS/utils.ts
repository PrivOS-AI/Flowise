/**
 * PrivOS Utility Functions
 * Helper functions for PrivOS integration
 */

import FormData from 'form-data'
import { secureAxiosRequest } from '../../src/httpSecurity'
import { PRIVOS_ENDPOINTS, PRIVOS_HEADERS, ERROR_MESSAGES } from './constants'
import { ICommonObject } from '../../src'

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
     * Chuẩn hóa lỗi từ API hoặc System thành cấu trúc Node Output
     */
    wrapError: (nodeName: string, error: any, nodeId: string, state?: ICommonObject) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Internal Error'

        console.error(`[${nodeName}][ID: ${nodeId}] Execution Failed:`, error)

        return {
            id: nodeId,
            name: nodeName,
            state: state || {},
            output: {
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
