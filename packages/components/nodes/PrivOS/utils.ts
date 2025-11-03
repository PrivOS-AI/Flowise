/**
 * PrivOS Utility Functions
 * Helper functions for PrivOS integration
 */

import FormData from 'form-data'
import { secureAxiosRequest } from '../../src/httpSecurity'
import { PRIVOS_ENDPOINTS, PRIVOS_HEADERS, ERROR_MESSAGES } from './constants'

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
