/**
 * PrivOS Utility Functions
 * Helper functions for PrivOS integration
 */

import FormData from 'form-data'
import { secureAxiosRequest } from '../../src/httpSecurity'
import { PRIVOS_ENDPOINTS, PRIVOS_HEADERS, ERROR_MESSAGES } from './constants'

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
