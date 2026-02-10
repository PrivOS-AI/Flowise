const getCurrentUser = () => {
    if (!localStorage.getItem('user') || localStorage.getItem('user') === 'undefined') return undefined
    return JSON.parse(localStorage.getItem('user'))
}

const updateCurrentUser = (user) => {
    let stringifiedUser = user
    if (typeof user === 'object') {
        stringifiedUser = JSON.stringify(user)
    }
    localStorage.setItem('user', stringifiedUser)
}

const removeCurrentUser = () => {
    _removeFromStorage()
    clearAllCookies()
}

const _removeFromStorage = () => {
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('isGlobal')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
    localStorage.removeItem('features')
    localStorage.removeItem('isSSO')
    localStorage.removeItem('roomWorkspaceId')
}

const clearAllCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0].trim()
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    })
}

const extractUser = (payload) => {
    const user = {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        status: payload.status,
        role: payload.role,
        isSSO: payload.isSSO,
        activeOrganizationId: payload.activeOrganizationId,
        activeOrganizationSubscriptionId: payload.activeOrganizationSubscriptionId,
        activeOrganizationCustomerId: payload.activeOrganizationCustomerId,
        activeOrganizationProductId: payload.activeOrganizationProductId,
        activeWorkspaceId: payload.activeWorkspaceId,
        activeWorkspace: payload.activeWorkspace,
        lastLogin: payload.lastLogin,
        isOrganizationAdmin: payload.isOrganizationAdmin,
        assignedWorkspaces: payload.assignedWorkspaces,
        permissions: payload.permissions,
        activeRoomId: payload.activeRoomId,
        isRootAdmin: payload.isRootAdmin !== undefined ? payload.isRootAdmin : true
    }
    return user
}

const updateStateAndLocalStorage = (state, payload) => {
    const user = extractUser(payload)
    state.user = user
    state.token = payload.token
    state.permissions = payload.permissions
    state.features = payload.features
    state.isAuthenticated = true
    state.isGlobal = user.isOrganizationAdmin
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('isGlobal', state.isGlobal)
    localStorage.setItem('isSSO', state.user.isSSO)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('permissions', JSON.stringify(payload.permissions))
    localStorage.setItem('features', JSON.stringify(payload.features))

    // Set roomWorkspaceId from user's activeRoomId or roomId if available
    const roomId = user.activeRoomId || user.roomId
    if (roomId) {
        localStorage.setItem('roomWorkspaceId', roomId)
        // Dispatch event to notify WorkspaceContext to update UI
        import('@/store/context/RoomWorkspaceContext').then((module) => {
            module.dispatchRoomWorkspaceIdChanged(roomId)
        })
    }
}

const AuthUtils = {
    getCurrentUser,
    updateCurrentUser,
    removeCurrentUser,
    updateStateAndLocalStorage,
    extractUser
}

export default AuthUtils
