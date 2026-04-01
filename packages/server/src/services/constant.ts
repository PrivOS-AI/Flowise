import logger from '../utils/logger'

/**
 * Security configuration for PrivosBoardService
 */
export const SECURITY_CONFIG = {
    // Rate limiting: max requests per minute per IP/API key
    RATE_LIMIT: {
        points: 10, // Number of requests
        duration: 60 // Duration in seconds
    },
    // Field length limits
    MAX_LENGTH: {
        name: 200,
        description: 5000,
        customFieldValue: 2000,
        fieldId: 100
    },
    // Dangerous patterns to block
    BLOCKED_PATTERNS: [
        /<script[^>]*>.*?<\/script>/gi, // Script tags
        /javascript:/gi, // JavaScript protocol
        /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
        /<iframe[^>]*>/gi, // Iframe tags
        /<embed[^>]*>/gi, // Embed tags
        /<object[^>]*>/gi, // Object tags
        /<link[^>]*>/gi, // Link tags
        /<meta[^>]*>/gi, // Meta tags
        /\$\{.*?\}/g, // Template literals injection
        /eval\s*\(/gi, // eval() calls
        /expression\s*\(/gi, // CSS expression()
        /@import/i, // CSS imports
        /data:text\/html/i, // Data URI with HTML
        /vbscript:/gi, // VBScript protocol
        /from\s+chrome-extension/i, // Chrome extension injection
        /moz-extension:/gi // Firefox extension injection
    ],
    // SQL injection patterns
    SQL_INJECTION_PATTERNS: [
        /(%27)|(')|(--)|(%23)|(#)/i,
        /(\bor\b|\band\b).*?=/i,
        /exec(\s|\+)+(s|x)p\w+/i,
        /union(\s|\+)+(select|all)/i,
        /select(\s|\+).*?from/i,
        /insert(\s|\+).*?into/i,
        /delete(\s|\+).*?from/i,
        /update(\s|\+).*?set/i,
        /drop(\s|\+)(table|database)/i
    ]
}

/**
 * Rate limiter tracking (in-memory, simple implementation)
 */
interface RateLimitEntry {
    count: number
    resetTime: number
}

const rateLimitTracker = new Map<string, RateLimitEntry>()

/**
 * Clean up expired rate limit entries
 */
export function cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of rateLimitTracker.entries()) {
        if (now > entry.resetTime) {
            rateLimitTracker.delete(key)
        }
    }
}

/**
 * Check rate limit for a given key
 * @throws Error if rate limit exceeded
 */
export function checkRateLimit(key: string): void {
    const now = Date.now()

    // Clean up expired entries periodically
    if (rateLimitTracker.size > 1000) {
        cleanupExpiredEntries()
    }

    let entry = rateLimitTracker.get(key)

    // If entry doesn't exist or expired, create new one
    if (!entry || now > entry.resetTime) {
        entry = {
            count: 1,
            resetTime: now + SECURITY_CONFIG.RATE_LIMIT.duration * 1000
        }
        rateLimitTracker.set(key, entry)
        return
    }

    // Increment counter
    entry.count++

    // Check if exceeded
    if (entry.count > SECURITY_CONFIG.RATE_LIMIT.points) {
        const resetTime = Math.ceil((entry.resetTime - now) / 1000)
        logger.warn(`[Security] Rate limit exceeded for key: ${key}, resets in ${resetTime}s`)
        throw new Error(`Rate limit exceeded. Please try again in ${resetTime} seconds.`)
    }

    rateLimitTracker.set(key, entry)
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string, maxLength: number): string {
    if (typeof input !== 'string') {
        return String(input)
    }

    // Trim whitespace
    let sanitized = input.trim()

    // Check length limit
    if (sanitized.length > maxLength) {
        logger.warn(`[Security] Input exceeded max length ${maxLength}, truncating`)
        sanitized = sanitized.substring(0, maxLength)
    }

    // Check for blocked patterns
    for (const pattern of SECURITY_CONFIG.BLOCKED_PATTERNS) {
        if (pattern.test(sanitized)) {
            logger.warn(`[Security] Blocked dangerous pattern: ${pattern}`)
            throw new Error('Input contains potentially dangerous content')
        }
    }

    // Check for SQL injection patterns
    for (const pattern of SECURITY_CONFIG.SQL_INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
            logger.warn(`[Security] Blocked SQL injection pattern: ${pattern}`)
            throw new Error('Input contains potentially dangerous content')
        }
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '')

    // Normalize unicode
    sanitized = sanitized.normalize('NFC')

    return sanitized
}

/**
 * Validate custom field ID format
 */
export function validateFieldId(fieldId: string): boolean {
    // Field ID should be alphanumeric with underscores and dashes, reasonable length
    const fieldIdPattern = /^[a-zA-Z0-9_-]{1,100}$/
    return fieldIdPattern.test(fieldId)
}

/**
 * Validate custom field value
 */
export function validateFieldValue(value: any): string {
    if (value === null || value === undefined) {
        return ''
    }

    // Convert to string if not already
    const strValue = typeof value === 'string' ? value : JSON.stringify(value)

    // Sanitize the value
    return sanitizeString(strValue, SECURITY_CONFIG.MAX_LENGTH.customFieldValue)
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): { remaining: number; resetTime: number } {
    const entry = rateLimitTracker.get(key)
    const now = Date.now()

    if (!entry || now > entry.resetTime) {
        return {
            remaining: SECURITY_CONFIG.RATE_LIMIT.points,
            resetTime: now + SECURITY_CONFIG.RATE_LIMIT.duration * 1000
        }
    }

    return {
        remaining: Math.max(0, SECURITY_CONFIG.RATE_LIMIT.points - entry.count),
        resetTime: entry.resetTime
    }
}
