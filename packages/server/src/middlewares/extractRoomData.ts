/**
 * Middleware to extract room isolation data from JWT token
 * This extracts roomId and isRootAdmin from the JWT payload and adds them to the Request object
 * This approach avoids modifying the enterprise LoggedInUser interface
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/**
 * Extract room data from JWT and add to Request object
 */
export const extractRoomDataMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Try to get token from cookie first, then from Authorization header
        let token = req.cookies?.token

        if (!token) {
            const authHeader = req.headers.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7)
            }
        }

        if (token) {
            // Decode the JWT to get the payload (don't verify, just decode)
            // The JWT has already been verified by passport middleware
            const decoded = jwt.decode(token) as any

            if (decoded) {
                // Extract room data from JWT payload
                req.roomId = decoded.roomId
                req.isRootAdmin = decoded.isRootAdmin !== undefined ? decoded.isRootAdmin : true // Default to true for native login
            }
        } else {
            // No token - default to root admin (for API key access, etc.)
            req.isRootAdmin = true
        }
    } catch (error) {
        // If anything fails, default to root admin to not break existing functionality
        req.isRootAdmin = true
    }

    next()
}
