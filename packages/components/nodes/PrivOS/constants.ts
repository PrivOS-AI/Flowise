/**
 * PrivOS Constants
 * Centralized constants for PrivOS integration
 *
 * Environment variables:
 * - PRIVOS_API_BASE_URL: Base URL for PrivOS API
 */

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const PRIVOS_API_VERSION = 'v1'

// Read from environment variable once at startup
const PRIVOS_BASE_URL = process.env.PRIVOS_API_BASE_URL || 'https://privos-chat-dev.roxane.one/api/v1'

export const DEFAULT_PRIVOS_API_BASE_URL = PRIVOS_BASE_URL

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const PRIVOS_ENDPOINTS = {
    ROOMS_GET: '/rooms.get',
    LISTS_BY_ROOM_ID: '/external.lists.byRoomId',
    LIST_DETAIL: '/external.lists',
    ITEMS_BATCH_CREATE: '/external.items.batch-create',
    ITEMS_UPDATE: '/external.items.update',
    ITEMS_INFO: '/external.items.info',
    ITEMS_BY_STAGE_ID: '/external.items.byStageId',
    ITEMS_BY_LIST_ID: '/external.items.byListId',
    ITEMS_MOVE: '/external.items.move',
    STAGES_BY_LIST_ID: '/external.stages.byListId',
    DOCUMENTS_BATCH_CREATE: '/external.documents.batch-create',
    DOCUMENTS_GET: '/external.documents',
    DOCUMENTS_UPDATE: '/external.documents',
    DOCUMENTS_BY_ROOM_ID: '/external.documents.byRoomId',
    FILES_UPLOAD: '/files.upload',
    CHANNELS_MEMBERS: '/channels.members',
    GROUPS_MEMBERS: '/groups.members',
    IM_MEMBERS: '/im.members'
} as const

// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

export const FIELD_TYPES = {
    TEXT: 'TEXT',
    TEXTAREA: 'TEXTAREA',
    NUMBER: 'NUMBER',
    DATE: 'DATE',
    DATE_TIME: 'DATE_TIME',
    SELECT: 'SELECT',
    MULTI_SELECT: 'MULTI_SELECT',
    USER: 'USER',
    CHECKBOX: 'CHECKBOX',
    URL: 'URL',
    FILE: 'FILE',
    FILE_MULTIPLE: 'FILE_MULTIPLE',
    DOCUMENT: 'DOCUMENT'
} as const

// Field Type Options for UI
export const FIELD_TYPE_OPTIONS = [
    { label: 'Text', name: FIELD_TYPES.TEXT },
    { label: 'Text Area', name: FIELD_TYPES.TEXTAREA },
    { label: 'Number', name: FIELD_TYPES.NUMBER },
    { label: 'Date', name: FIELD_TYPES.DATE },
    { label: 'Date Time', name: FIELD_TYPES.DATE_TIME },
    { label: 'Select', name: FIELD_TYPES.SELECT },
    { label: 'Multi Select', name: FIELD_TYPES.MULTI_SELECT },
    { label: 'User', name: FIELD_TYPES.USER },
    { label: 'Checkbox', name: FIELD_TYPES.CHECKBOX },
    { label: 'URL', name: FIELD_TYPES.URL },
    { label: 'File', name: FIELD_TYPES.FILE },
    { label: 'Multiple Files', name: FIELD_TYPES.FILE_MULTIPLE },
    { label: 'Document', name: FIELD_TYPES.DOCUMENT }
] as const

// ============================================================================
// PRIVOS FIELD IDS - Template Field Definitions
// ============================================================================

/**
 * Field IDs for different list templates in PrivOS
 * These IDs are consistent across environments (dev/staging/prod)
 */
export const PRIVOS_FIELD_IDS = {
    // Marketing Campaign Template (templateKey: 'marketing')
    MARKETING: {
        ASSIGNEES: 'marketing_campaign_assignees_field',
        DUE_DATE: 'marketing_campaign_due_date_field',
        START_DATE: 'marketing_campaign_start_date_field',
        END_DATE: 'marketing_campaign_end_date_field',
        FILE: 'marketing_campaign_file_link_field',
        DOCUMENTS: 'marketing_campaign_documents_field',
        NOTE: 'marketing_campaign_note_field'
    },
    // HR/Recruitment Template (templateKey: 'personnel-recruitment')
    RECRUITMENT: {
        CV: 'recruitment_cv_field',
        AI_SUMMARY: 'recruitment_ai_summary_field',
        AI_SCORE: 'recruitment_ai_score_field',
        INTERVIEW_TIME: 'recruitment_interview_time_field',
        INTERVIEWER: 'recruitment_interviewer_field',
        INTERVIEW_QUESTIONS: 'recruitment_interview_questions_field',
        INTERVIEW_NOTES: 'recruitment_interview_notes_field',
        INTERVIEW_SCORE: 'recruitment_interview_score_field',
        TRIAL_TIME: 'recruitment_trial_time_field',
        CV_CONTENT: 'recruitment_cv_content_field'
    }
} as const

// ============================================================================
// ROOM CONFIGURATION
// ============================================================================

export const ROOM_TYPES = {
    DIRECT: 'd',
    PRIVATE: 'p',
    CHANNEL: 'c'
} as const

export const ROOM_TYPE_LABELS: Record<string, string> = {
    [ROOM_TYPES.DIRECT]: 'Direct',
    [ROOM_TYPES.PRIVATE]: 'Private',
    [ROOM_TYPES.CHANNEL]: 'Public'
}

// ============================================================================
// HTTP HEADERS
// ============================================================================

export const PRIVOS_HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    USER_ID: 'X-User-Id',
    AUTH_TOKEN: 'X-Auth-Token'
} as const

// ============================================================================
// CONTENT TYPES
// ============================================================================

export const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM_DATA: 'multipart/form-data'
} as const

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
    MISSING_CREDENTIALS: 'Missing credentials: User ID and Auth Token are required',
    MISSING_USER_ID: 'Missing userId or authToken',
    NO_CREDENTIAL_ID: 'No credential ID found!',
    NO_CREDENTIAL_DATA: 'No credential data returned!',
    INVALID_DATE_FORMAT: (fieldName: string) => `Invalid date format for ${fieldName}. Expected ISO format like: 2025-10-31T00:00:00.000Z`,
    MISSING_ROOM_SELECTION: 'Please select a room',
    MISSING_LIST_SELECTION: 'Please select a list',
    MISSING_STAGE_SELECTION: 'Please select a stage',
    MISSING_DOCUMENT_ID: 'Document ID is required',
    MISSING_ITEM_NAME: 'Item name is required',
    INVALID_JSON_PAYLOAD: 'JSON Payload is required when using JSON Object mode',
    JSON_MISSING_DOCUMENT_ID: 'JSON payload must have "documentId" field',
    UPLOAD_FAILED: (message: string) => `Failed to upload file: ${message}`,
    INVALID_ASSIGNEES_FORMAT: 'Invalid assignees format',
    DOCUMENT_MISSING_TITLE: (index: number) => `Document #${index + 1} must have a title`,
    DOCUMENT_MISSING_CONTENT: (index: number) => `Document #${index + 1} must have content`,
    DOCUMENTS_REQUIRED: 'Documents Data is required and must contain at least 1 document'
} as const

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
    DOCUMENTS_CREATED: 'DOCUMENTS CREATED SUCCESSFULLY',
    DOCUMENT_UPDATED: (id: string, fields: string[]) =>
        `Document ${id} updated successfully. Updated fields: ${fields.join(', ') || 'none'}`,
    ITEM_CREATED: 'ITEM CREATED SUCCESSFULLY',
    ITEMS_CREATED: 'ITEMS CREATED SUCCESSFULLY'
} as const

// ============================================================================
// REQUEST CONFIGURATION
// ============================================================================

export const REQUEST_CONFIG = {
    DEFAULT_OFFSET: 0,
    DEFAULT_COUNT: 100,
    MAX_RETRIES: 3,
    TIMEOUT: 30000 // 30 seconds
} as const
