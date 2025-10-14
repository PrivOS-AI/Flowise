import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import logger from '../../utils/logger'
import { v4 as uuidv4 } from 'uuid'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { encryptToken } from '../../enterprise/utils/tempTokenUtils'

const router = express.Router()

/**
 * SSO Endpoint for External Authentication
 *
 * Usage:
 *   Redirect from external service (Rocket.Chat):
 *   https://flowise.example.com/api/v1/external-sso?token=AUTH_TOKEN&userId=USER_ID&redirect=/chatflows
 *
 * Flow:
 *   1. Extract token and userId from query params
 *   2. Call EXTERNAL_AUTH_PROFILE_URL with X-Auth-Token and X-User-Id headers
 *   3. Create session cookie
 *   4. Redirect to dashboard or specified redirect path
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        logger.info('[ExternalSSO]: ========== NEW SSO REQUEST ==========')
        logger.info(`[ExternalSSO]: Request URL: ${req.url}`)
        logger.info(`[ExternalSSO]: Request query params: ${JSON.stringify(req.query)}`)

        const token = req.query.token as string
        const requestUserId = req.query.userId as string
        const redirectPath = (req.query.redirect as string) || '/'

        logger.info(`[ExternalSSO]: Extracted token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`)
        logger.info(`[ExternalSSO]: Extracted userId: ${requestUserId || 'MISSING'}`)
        logger.info(`[ExternalSSO]: Redirect path: ${redirectPath}`)

        if (!token) {
            logger.error('[ExternalSSO]: Missing token parameter')
            return res.status(400).json({ error: 'Token parameter is required' })
        }

        if (!requestUserId) {
            logger.error('[ExternalSSO]: Missing userId parameter')
            return res.status(400).json({ error: 'UserId parameter is required' })
        }

        const profileUrl = process.env.EXTERNAL_AUTH_PROFILE_URL

        if (!profileUrl) {
            logger.error('[ExternalSSO]: EXTERNAL_AUTH_PROFILE_URL not configured')
            return res.status(500).json({ error: 'External auth not configured' })
        }

        logger.info(`[ExternalSSO]: Profile URL configured: ${profileUrl}`)
        logger.info('[ExternalSSO]: Calling Rocket.Chat API to validate token...')

        let userData: any
        try {
            const response = await axios.get(profileUrl, {
                headers: {
                    'X-Auth-Token': token,
                    'X-User-Id': requestUserId,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            })

            userData = response.data
            logger.info(`[ExternalSSO]: Rocket.Chat API response status: ${response.status}`)
            logger.info(`[ExternalSSO]: User data received: ${JSON.stringify(userData)}`)

            if (userData.success === false) {
                logger.error('[ExternalSSO]: Rocket.Chat API returned success=false')
                return res.status(401).json({ error: 'Invalid token' })
            }
        } catch (error: any) {
            logger.error(`[ExternalSSO]: Token validation failed: ${error.message}`)
            logger.error(`[ExternalSSO]: Error details: ${JSON.stringify(error.response?.data || error)}`)
            return res.status(401).json({ error: 'Token validation failed' })
        }

        // Extract user info
        const userId = userData._id || userData.id || userData.userId
        const email = userData.emails && userData.emails.length > 0 ? userData.emails[0].address : userData.email || userData.username
        const name = userData.name || userData.displayName || userData.username || email
        const roles = userData.roles || []

        logger.info(`[ExternalSSO]: Extracted userId: ${userId}`)
        logger.info(`[ExternalSSO]: Extracted email: ${email}`)
        logger.info(`[ExternalSSO]: Extracted name: ${name}`)
        logger.info(`[ExternalSSO]: Extracted roles: ${JSON.stringify(roles)}`)

        if (!userId || !email) {
            logger.error('[ExternalSSO]: Missing required user data (userId or email)')
            return res.status(401).json({ error: 'Invalid user data' })
        }

        // Map roles to permissions
        let permissions: string[] = ['chatflows:view']
        if (roles.includes('admin')) {
            permissions = [
                'chatflows:view',
                'chatflows:create',
                'chatflows:update',
                'chatflows:delete',
                'credentials:view',
                'credentials:create',
                'credentials:update',
                'credentials:delete'
            ]
            logger.info('[ExternalSSO]: User has admin role - granted full permissions')
        } else if (roles.includes('bot')) {
            permissions = ['chatflows:view', 'chatflows:create', 'credentials:view']
            logger.info('[ExternalSSO]: User has bot role - granted create permissions')
        } else if (roles.includes('user')) {
            permissions = ['chatflows:view', 'credentials:view']
            logger.info('[ExternalSSO]: User has user role - granted read-only permissions')
        } else {
            logger.info('[ExternalSSO]: User has no recognized role - granted minimal permissions')
        }
        logger.info(`[ExternalSSO]: Final permissions: ${JSON.stringify(permissions)}`)

        // Check if workspace exists in database - redirect to setup if not
        const app = getRunningExpressApp()
        const workspaces = await app.AppDataSource.getRepository('Workspace').find({ take: 1 })

        if (workspaces.length === 0) {
            logger.warn('[ExternalSSO]: No workspace found in database - redirecting to organization setup')
            logger.info(`[ExternalSSO]: User ${email} needs to complete initial setup`)
            return res.redirect('/organization-setup')
        }

        const workspaceId = workspaces[0].id
        logger.info(`[ExternalSSO]: Using workspace ID: ${workspaceId}`)

        // Create encrypted meta field (required by Flowise JWT strategy)
        const encryptedUserInfo = encryptToken(`${userId}:${workspaceId}`)
        logger.info(`[ExternalSSO]: Created encrypted meta field for JWT`)

        // Create auth token (matching Flowise native format)
        const authToken = jwt.sign(
            {
                id: userId,
                username: name,
                meta: encryptedUserInfo
            },
            process.env.JWT_AUTH_TOKEN_SECRET || 'default-secret',
            {
                expiresIn: process.env.JWT_TOKEN_EXPIRY_IN_MINUTES ? `${process.env.JWT_TOKEN_EXPIRY_IN_MINUTES}m` : '360m',
                notBefore: '0',
                algorithm: 'HS256',
                issuer: process.env.JWT_ISSUER || 'ISSUER',
                audience: process.env.JWT_AUDIENCE || 'AUDIENCE'
            }
        )

        // Create refresh token (same format)
        const refreshToken = jwt.sign(
            {
                id: userId,
                username: name,
                meta: encryptedUserInfo
            },
            process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_AUTH_TOKEN_SECRET || 'default-secret',
            {
                expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES
                    ? `${process.env.JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES}m`
                    : '43200m',
                notBefore: '0',
                algorithm: 'HS256',
                issuer: process.env.JWT_ISSUER || 'ISSUER',
                audience: process.env.JWT_AUDIENCE || 'AUDIENCE'
            }
        )

        logger.info(`[ExternalSSO]: Created JWT tokens with proper format (id, username, meta)`)

        // Build user object for frontend (matching Flowise format)
        const returnUser = {
            id: userId,
            email,
            name,
            status: 'ACTIVE',
            role: roles.includes('admin') ? 'ADMIN' : 'USER',
            isSSO: true,
            activeOrganizationId: 'external-org',
            activeOrganizationSubscriptionId: '',
            activeOrganizationCustomerId: '',
            activeOrganizationProductId: '',
            activeWorkspaceId: 'external-workspace',
            activeWorkspace: 'external-workspace',
            assignedWorkspaces: [],
            isOrganizationAdmin: roles.includes('admin'),
            permissions,
            features: {},
            token: authToken,
            refreshToken
        }

        // Determine secure cookie setting
        const secureCookie =
            process.env.SECURE_COOKIES === 'false'
                ? false
                : process.env.SECURE_COOKIES === 'true'
                ? true
                : process.env.APP_URL?.startsWith('https')
                ? true
                : false

        // Set authentication cookies NOW (before redirect)
        logger.info('[ExternalSSO]: Setting authentication cookies (token and refreshToken)')
        res.cookie('token', authToken, {
            httpOnly: true,
            secure: secureCookie,
            sameSite: 'lax'
        })
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: secureCookie,
            sameSite: 'lax'
        })

        // Create session for the user (required by Flowise JWT strategy)
        const sessionUser = {
            id: userId,
            email: email,
            name: name,
            roleId: 'external-user',
            activeOrganizationId: 'external-org',
            activeOrganizationSubscriptionId: '',
            activeOrganizationCustomerId: '',
            activeOrganizationProductId: '',
            isOrganizationAdmin: roles.includes('admin'),
            activeWorkspaceId: workspaceId,
            activeWorkspace: workspaceId,
            assignedWorkspaces: [],
            isApiKeyValidated: false,
            permissions: permissions,
            features: {}
        }

        // Store user in session
        if (req.session) {
            ;(req.session as any).passport = { user: sessionUser }
            logger.info('[ExternalSSO]: Stored user in session')
        }

        // Generate temporary SSO token and store user data in cache
        const ssoToken = uuidv4()
        logger.info(`[ExternalSSO]: Generated temporary SSO token: ${ssoToken}`)

        const appServer = getRunningExpressApp()
        logger.info('[ExternalSSO]: Got express app instance')

        appServer.cachePool.addSSOTokenCache(ssoToken, returnUser)
        logger.info('[ExternalSSO]: Stored user data in cache successfully')
        logger.info(
            `[ExternalSSO]: Cache data: ${JSON.stringify({
                id: returnUser.id,
                email: returnUser.email,
                permissions: returnUser.permissions
            })}`
        )

        logger.info(`[ExternalSSO]: ========== SSO LOGIN SUCCESSFUL ==========`)
        logger.info(`[ExternalSSO]: User: ${email}`)
        logger.info(`[ExternalSSO]: SSO Token: ${ssoToken}`)
        logger.info(`[ExternalSSO]: Cookies set: token and refreshToken`)
        logger.info(`[ExternalSSO]: Redirecting to: /external-sso-success?token=${ssoToken}`)
        logger.info(`[ExternalSSO]: ==========================================`)

        // Redirect to external SSO success page (frontend will fetch user data from /api/v1/external-sso/success)
        const dashboardUrl = `/external-sso-success?token=${ssoToken}`
        res.redirect(dashboardUrl)
    } catch (error) {
        logger.error(`[ExternalSSO]: Error: ${error}`)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * SSO Success endpoint - called by frontend after redirect
 * Returns user data from cache
 */
router.get('/success', async (req: Request, res: Response) => {
    try {
        logger.info('[ExternalSSO Success]: ========== SSO SUCCESS ENDPOINT CALLED ==========')
        logger.info(`[ExternalSSO Success]: Request URL: ${req.url}`)
        logger.info(`[ExternalSSO Success]: Query params: ${JSON.stringify(req.query)}`)

        const ssoToken = req.query.token as string

        if (!ssoToken) {
            logger.error('[ExternalSSO Success]: No token provided in query params')
            return res.status(400).json({ message: 'Token parameter is required' })
        }

        logger.info(`[ExternalSSO Success]: Looking up token in cache: ${ssoToken}`)

        const appServer = getRunningExpressApp()
        logger.info('[ExternalSSO Success]: Got express app instance')

        const user = await appServer.cachePool.getSSOTokenCache(ssoToken)
        logger.info(`[ExternalSSO Success]: Cache lookup result: ${user ? 'FOUND' : 'NOT FOUND'}`)

        if (!user) {
            logger.error('[ExternalSSO Success]: Token not found in cache or expired')
            return res.status(401).json({ message: 'Invalid or expired SSO token' })
        }

        logger.info(`[ExternalSSO Success]: User found in cache: ${user.email}`)
        logger.info(
            `[ExternalSSO Success]: User data: ${JSON.stringify({ id: user.id, email: user.email, permissions: user.permissions })}`
        )

        // Delete token after use (one-time use)
        await appServer.cachePool.deleteSSOTokenCache(ssoToken)
        logger.info('[ExternalSSO Success]: Deleted token from cache (one-time use)')

        logger.info(`[ExternalSSO Success]: ========== RETURNING USER DATA ==========`)
        logger.info(`[ExternalSSO Success]: Email: ${user.email}`)
        logger.info(`[ExternalSSO Success]: Permissions: ${JSON.stringify(user.permissions)}`)
        logger.info(`[ExternalSSO Success]: =======================================`)

        return res.json(user)
    } catch (error) {
        logger.error(`[ExternalSSO Success]: ERROR: ${error}`)
        logger.error(`[ExternalSSO Success]: Stack trace: ${error instanceof Error ? error.stack : 'N/A'}`)
        return res.status(500).json({ message: 'Internal server error' })
    }
})

/**
 * Logout endpoint
 */
router.post('/logout', (req: Request, res: Response) => {
    res.clearCookie('token')
    res.clearCookie('refreshToken')

    const returnUrl = req.query.returnUrl as string
    if (returnUrl) {
        res.redirect(returnUrl)
    } else {
        res.json({ success: true, message: 'Logged out successfully' })
    }
})

export default router
