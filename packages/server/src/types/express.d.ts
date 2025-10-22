/**
 * Custom Express Request type extensions
 * This file extends the Express Request interface to include custom properties
 * without modifying enterprise code
 */

declare global {
    namespace Express {
        interface Request {
            // Room isolation properties extracted from JWT
            roomId?: string
            isRootAdmin?: boolean
        }
    }
}

export {}
