import { Request, Response, NextFunction } from 'express'
import axios from 'axios'
import logger from '../utils/logger'
import { LoggedInUser } from '../enterprise/Interface.Enterprise'
import { EXTERNAL_SSO_DEFAULT_PERMISSIONS } from '../utils/constants'

/**
 * External Authentication Middleware
 *
 * Validates tokens by calling an external profile API endpoint (e.g., Rocket.Chat)
 *
 * Configuration:
 *   EXTERNAL_AUTH_PROFILE_URL - URL to validate token and get user profile
 *
 * Usage:
 *   API calls: Authorization: Bearer <token>
 *   Query params: ?token=<token>&userId=<userId> (for redirects)
 *
 * The middleware will:
 *   1. Extract token from Authorization header OR query params
 *   2. Call EXTERNAL_AUTH_PROFILE_URL with X-Auth-Token (and X-User-Id if provided)
 *   3. Get user info and map to Flowise user format
 *   4. Attach user to request for RBAC middleware
 */

interface ExternalUserProfile {
    _id?: string
    id?: string
    userId?: string
    username?: string
    email?: string
    emails?: Array<{ address: string; verified?: boolean }>
    name?: string
    displayName?: string
    roles?: string[]
    [key: string]: any
}

/**
 * Default permission mapping based on user roles
 * Uses shared constant to ensure consistency with external-sso route
 */
const getDefaultPermissions = (_userData: ExternalUserProfile): string[] => {
    // Return shared default permissions for all SSO users
    return EXTERNAL_SSO_DEFAULT_PERMISSIONS
}

/**
 * External authentication middleware
 * Validates token by calling external profile URL
 */
export const verifyExternalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profileUrl = process.env.EXTERNAL_AUTH_PROFILE_URL

        if (!profileUrl) {
            return next() // No profile URL configured, skip external auth
        }

        // Extract token from Authorization header OR query params
        let token: string | undefined
        let requestUserId: string | undefined

        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7) // Remove 'Bearer ' prefix
        } else if (req.query.token) {
            // Support token in query params (e.g., for redirects)
            token = req.query.token as string
            requestUserId = req.query.userId as string
        }

        if (!token) {
            return next() // No token, continue to next middleware
        }

        // Validate token by calling external profile API
        logger.info(`[ExternalAuth]: Validating token with profile URL`)

        let userData: ExternalUserProfile
        try {
            const headers: any = {
                'X-Auth-Token': token,
                'Content-Type': 'application/json'
            }

            // Add X-User-Id if provided in query params
            if (requestUserId) {
                headers['X-User-Id'] = requestUserId
            }

            const response = await axios.get(profileUrl, {
                headers,
                timeout: 10000 // 10 second timeout
            })

            userData = response.data

            // Check if API returned error
            if (userData.success === false || response.status !== 200) {
                logger.warn('[ExternalAuth]: Profile API returned error')
                return res.status(401).json({ error: 'Invalid token' })
            }
        } catch (error: any) {
            if (error.response) {
                logger.error(`[ExternalAuth]: Profile API error: ${error.response.status}`)
                return res.status(401).json({ error: 'Token validation failed' })
            } else if (error.request) {
                logger.error(`[ExternalAuth]: No response from profile API`)
                return res.status(503).json({ error: 'Profile service unavailable' })
            } else {
                logger.error(`[ExternalAuth]: Error calling profile API: ${error.message}`)
                return res.status(500).json({ error: 'Internal server error' })
            }
        }

        // Extract user information from profile response
        const userId = userData._id || userData.id || userData.userId
        const email =
            userData.emails && userData.emails.length > 0
                ? userData.emails[0].address
                : userData.email || userData.username || `${userId}@external.user`
        const name = userData.name || userData.displayName || userData.username || email

        // Validate required fields
        if (!userId || !email) {
            logger.warn('[ExternalAuth]: Invalid user data from profile API')
            return res.status(401).json({ error: 'Invalid user data' })
        }

        // Get permissions based on roles
        const permissions = getDefaultPermissions(userData)

        // Map external user to Flowise LoggedInUser format
        const mappedUser: LoggedInUser = {
            id: userId,
            email: email,
            name: name,
            roleId: 'external-user',
            activeOrganizationId: 'external-org',
            activeOrganizationSubscriptionId: '',
            activeOrganizationCustomerId: '',
            activeOrganizationProductId: '',
            isOrganizationAdmin: false,
            activeWorkspaceId: 'external-workspace',
            activeWorkspace: 'external-workspace',
            assignedWorkspaces: [],
            isApiKeyValidated: false,
            permissions: permissions,
            features: {}
        }

        // Attach user to request
        req.user = mappedUser

        logger.info(`[ExternalAuth]: Authenticated user ${email} with roles: ${userData.roles?.join(', ') || 'none'}`)

        // Continue to next middleware
        next()
    } catch (error) {
        logger.error(`[ExternalAuth]: Unexpected error: ${error}`)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
