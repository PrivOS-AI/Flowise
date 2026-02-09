import PropTypes from 'prop-types'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ROOM_WORKSPACE_ID_CHANGED_EVENT = 'room-workspace-id-changed'

export const dispatchRoomWorkspaceIdChanged = (roomWorkspaceId) => {
    window.dispatchEvent(new CustomEvent(ROOM_WORKSPACE_ID_CHANGED_EVENT, { detail: { roomWorkspaceId } }))
}

const RoomWorkspaceContext = createContext()

export const RoomWorkspaceProvider = ({ children }) => {
    const [currentRoomWorkspace, setCurrentRoomWorkspace] = useState(null)
    const [roomWorkspaceId, setRoomWorkspaceId] = useState(null)

    // Load roomWorkspaceId on mount - priority: URL path > localStorage > user's activeRoomId/roomId
    useEffect(() => {
        const storedRoomWorkspace = localStorage.getItem('roomWorkspace')
        let finalRoomWorkspaceId = null

        // 1. Check URL path first segment
        const pathParts = window.location.pathname.split('/').filter(Boolean)
        if (pathParts.length > 0 && pathParts[0]) {
            finalRoomWorkspaceId = pathParts[0]
            localStorage.setItem('roomWorkspaceId', finalRoomWorkspaceId)
        }

        // 2. Check localStorage
        if (!finalRoomWorkspaceId) {
            const storedRoomWorkspaceId = localStorage.getItem('roomWorkspaceId')
            if (storedRoomWorkspaceId) {
                finalRoomWorkspaceId = storedRoomWorkspaceId
            }
        }

        // 3. Check user's activeRoomId or roomId (lowest priority)
        if (!finalRoomWorkspaceId) {
            const storedUser = localStorage.getItem('user')
            if (storedUser && storedUser !== 'undefined') {
                try {
                    const user = JSON.parse(storedUser)
                    const roomId = user.activeRoomId || user.roomId
                    if (roomId) {
                        finalRoomWorkspaceId = roomId
                        localStorage.setItem('roomWorkspaceId', roomId)
                    }
                } catch (e) {
                    console.error('Failed to parse stored user:', e)
                }
            }
        }

        if (finalRoomWorkspaceId) {
            setRoomWorkspaceId(finalRoomWorkspaceId)
        }

        // Load roomWorkspace object from localStorage
        if (storedRoomWorkspace) {
            try {
                setCurrentRoomWorkspace(JSON.parse(storedRoomWorkspace))
            } catch (e) {
                console.error('Failed to parse stored roomWorkspace:', e)
            }
        }
    }, [])

    // Listen for roomWorkspaceId changes from authUtils
    useEffect(() => {
        const handleRoomWorkspaceIdChanged = (event) => {
            const newRoomWorkspaceId = event.detail?.roomWorkspaceId
            if (newRoomWorkspaceId && newRoomWorkspaceId !== roomWorkspaceId) {
                setRoomWorkspaceId(newRoomWorkspaceId)

                // Skip navigation if currently on external-sso-success page (will be handled by the page itself)
                const currentPath = window.location.pathname
                if (currentPath.includes('external-sso-success')) {
                    return
                }

                // Navigate to the new workspace URL to trigger UI sync
                const pathParts = currentPath.split('/').filter(Boolean)
                const remainingPath = pathParts.slice(1).join('/') // Skip first element if exists
                window.location.href = `/${newRoomWorkspaceId}${remainingPath ? '/' + remainingPath : ''}`
            }
        }

        window.addEventListener(ROOM_WORKSPACE_ID_CHANGED_EVENT, handleRoomWorkspaceIdChanged)
        return () => {
            window.removeEventListener(ROOM_WORKSPACE_ID_CHANGED_EVENT, handleRoomWorkspaceIdChanged)
        }
    }, [roomWorkspaceId])

    const setRoomWorkspace = useCallback((workspace) => {
        setCurrentRoomWorkspace(workspace)
        setRoomWorkspaceId(workspace?._id || null)

        // Persist to localStorage
        if (workspace) {
            localStorage.setItem('roomWorkspace', JSON.stringify(workspace))
            localStorage.setItem('roomWorkspaceId', workspace._id)
        } else {
            localStorage.removeItem('roomWorkspace')
            localStorage.removeItem('roomWorkspaceId')
        }
    }, [])

    const clearRoomWorkspace = useCallback(() => {
        setCurrentRoomWorkspace(null)
        setRoomWorkspaceId(null)
        localStorage.removeItem('roomWorkspace')
        localStorage.removeItem('roomWorkspaceId')
    }, [])

    const switchRoomWorkspace = useCallback(
        (roomWorkspace) => {
            // Set the new roomWorkspace
            setRoomWorkspace(roomWorkspace)

            // Get the current path without roomWorkspaceId
            const pathParts = window.location.pathname.split('/').filter(Boolean)
            const remainingPath = pathParts.slice(1).join('/') // Skip first element (roomWorkspaceId)

            // Reload page to load new data with the new workspace context
            window.location.href = `/${roomWorkspace._id}${remainingPath ? '/' + remainingPath : ''}`
        },
        [setRoomWorkspace]
    )

    const value = {
        currentRoomWorkspace,
        roomWorkspaceId,
        setRoomWorkspace,
        clearRoomWorkspace,
        switchRoomWorkspace
    }

    return <RoomWorkspaceContext.Provider value={value}>{children}</RoomWorkspaceContext.Provider>
}

export const useRoomWorkspace = () => {
    const context = useContext(RoomWorkspaceContext)
    if (!context) {
        throw new Error('useRoomWorkspace must be used within a RoomWorkspaceProvider')
    }
    return context
}

RoomWorkspaceProvider.propTypes = {
    children: PropTypes.any
}
