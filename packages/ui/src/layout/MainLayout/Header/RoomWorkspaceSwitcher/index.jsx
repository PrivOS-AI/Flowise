import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'

// material-ui
import BusinessIcon from '@mui/icons-material/Business'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import { Button, MenuItem, Stack, Typography, Menu, CircularProgress, TextField, Box, Paper } from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import InputAdornment from '@mui/material/InputAdornment'

// hooks
import privosChatApi from '@/api/privos-chat'

// context
import { useRoomWorkspace } from '@/store/context/RoomWorkspaceContext'

// ==============================|| WORKSPACE SELECTOR DROPDOWN ||============================== //

// Styled Menu Component
const StyledMenu = styled((props) => (
    <Menu
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
        }}
        {...props}
    />
))(({ theme }) => ({
    '& .MuiPaper-root': {
        borderRadius: 8,
        marginTop: theme.spacing(1),
        minWidth: 280,
        maxWidth: 350,
        maxHeight: 400,
        boxShadow:
            'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        '& .MuiMenu-list': {
            padding: '4px 0',
            display: 'flex',
            flexDirection: 'column'
        },
        '& .MuiMenuItem-root': {
            '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            }
        }
    }
}))

// Styled scrollable list container
const ScrollableListContainer = styled(Box)(({ theme }) => ({
    maxHeight: 300,
    overflowY: 'auto',
    '&::-webkit-scrollbar': {
        width: 6
    },
    '&::-webkit-scrollbar-track': {
        background: theme.palette.grey[100]
    },
    '&::-webkit-scrollbar-thumb': {
        background: theme.palette.grey[400],
        borderRadius: 3
    }
}))

// Helper: Check if current user is root admin
const isUserRootAdmin = () => {
    try {
        const userStr = localStorage.getItem('user')
        if (userStr) {
            const user = JSON.parse(userStr)
            return user?.isRootAdmin === true
        }
    } catch (error) {
        console.error('Failed to check root admin from localStorage:', error)
    }
    return false
}

const RoomWorkspaceSwitcher = () => {
    const { roomWorkspaceId: urlRoomWorkspaceId } = useParams()
    const { currentRoomWorkspace, roomWorkspaceId, setRoomWorkspace, switchRoomWorkspace } = useRoomWorkspace()

    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)
    const [roomWorkspaces, setWorkspaces] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)

    // Search state
    const [searchKeyword, setSearchKeyword] = useState('')

    // Pagination state
    const [offset, setOffset] = useState(0)
    const count = 10 // Items per page (limit)
    const [hasMore, setHasMore] = useState(true)
    const [totalCount, setTotalCount] = useState(0)

    // Ref to track if searching or loading initial
    const isSearchModeRef = useRef(false)

    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const currentUser = useSelector((state) => state.auth.user)

    // Reset state when menu opens
    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget)
        setSearchKeyword('')
        setOffset(0)
        setHasMore(true)
        isSearchModeRef.current = false
    }

    // Debounce search
    const debounceSearch = useCallback(
        (() => {
            let timeoutId
            return (keyword) => {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    handleSearch(keyword)
                }, 500)
            }
        })(),
        []
    )

    // Fetch roomWorkspaces - support pagination and search
    const fetchWorkspaces = async (search = '', offsetValue = 0, append = false) => {
        try {
            if (!append) {
                setLoading(true)
            } else {
                setLoadingMore(true)
            }

            const response = await privosChatApi.getRoomsByUserId(currentUser?.id || '', {
                search,
                offset: offsetValue,
                count
            })

            const responseData = response.data
            const newWorkspaces = responseData?.rooms || []

            if (append) {
                setWorkspaces((prev) => [...prev, ...newWorkspaces])
            } else {
                setWorkspaces(newWorkspaces)
            }

            setTotalCount(responseData?.total || 0)
            setHasMore(responseData?.offset * responseData?.count < responseData?.total)

            // Set initial workspace if none selected
            if (!currentRoomWorkspace && !keyword && offsetValue === 0 && newWorkspaces.length > 0) {
                const initialWs = urlRoomWorkspaceId
                    ? newWorkspaces.find((ws) => ws._id === urlRoomWorkspaceId) || newWorkspaces[0]
                    : newWorkspaces[0]
                setRoomWorkspace(initialWs)
            }
        } catch (err) {
            console.error('Failed to fetch roomWorkspaces:', err)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }

    // Search handler
    const handleSearch = (keyword) => {
        isSearchModeRef.current = keyword.length > 0
        setOffset(0)
        setHasMore(true)
        fetchWorkspaces(keyword, 0, false)
    }

    // Load more handler
    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            const newOffset = offset + count
            setOffset(newOffset)
            fetchWorkspaces(searchKeyword, newOffset, true)
        }
    }

    // Initial fetch on mount
    useEffect(() => {
        if (!isAuthenticated || !currentUser?._id) return
        fetchWorkspaces('', 0, false)
    }, [isAuthenticated, currentUser?._id])

    // Sync with URL roomWorkspaceId
    useEffect(() => {
        if (urlRoomWorkspaceId && roomWorkspaces.length > 0) {
            const foundWorkspace = roomWorkspaces.find((ws) => ws._id === urlRoomWorkspaceId)
            if (foundWorkspace && (!currentRoomWorkspace || currentRoomWorkspace._id !== urlRoomWorkspaceId)) {
                setRoomWorkspace(foundWorkspace)
            }
        }
    }, [urlRoomWorkspaceId, roomWorkspaces])

    // Refresh data when menu opens
    useEffect(() => {
        if (open && !loading) {
            const keyword = isSearchModeRef.current ? searchKeyword : ''
            setOffset(0)
            fetchWorkspaces(keyword, 0, false)
        }
    }, [open])

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleSelectRoomWorkspace = (workspace) => {
        handleClose()
        switchRoomWorkspace(workspace)
    }

    const handleSearchInputChange = (e) => {
        const keyword = e.target.value
        setSearchKeyword(keyword)
        debounceSearch(keyword)
    }

    // Scroll handler for load more
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        if (scrollHeight - scrollTop - clientHeight < 80 && hasMore && !loadingMore) {
            handleLoadMore()
        }
    }

    // Hide RoomWo for root admin users (must be after all hooks)
    if (isUserRootAdmin()) {
        return null
    }

    if (!isAuthenticated) {
        return null
    }

    return (
        <>
            <Button
                sx={{ mr: 1 }}
                id='room-workspace-selector'
                aria-controls={open ? 'room-workspace-selector-menu' : undefined}
                aria-haspopup='true'
                aria-expanded={open ? 'true' : undefined}
                disableElevation
                onClick={handleMenuOpen}
                endIcon={loading ? <CircularProgress size={16} /> : <KeyboardArrowDownIcon />}
                startIcon={<BusinessIcon />}
                disabled={loading}
            >
                <Stack alignItems='flex-start'>
                    <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1 }}>
                        Room
                    </Typography>
                    <Typography variant='body2' sx={{ lineHeight: 1.2, mt: 0.25 }}>
                        {currentRoomWorkspace?.fname || 'Select...'}
                    </Typography>
                </Stack>
            </Button>
            <StyledMenu
                id='room-workspace-selector-menu'
                MenuListProps={{
                    'aria-labelledby': 'room-workspace-selector',
                    disablePadding: true
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                {/* Search Input */}
                <Box sx={{ p: 2, pb: 1 }}>
                    <TextField
                        fullWidth
                        size='small'
                        placeholder='Search room...'
                        value={searchKeyword}
                        onChange={handleSearchInputChange}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon fontSize='small' />
                                </InputAdornment>
                            )
                        }}
                        autoFocus
                    />
                </Box>

                {/* Workspace List */}
                <ScrollableListContainer onScroll={handleScroll}>
                    {roomWorkspaces.length === 0 && !loading && !loadingMore && (
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant='body2' color='text.secondary'>
                                {searchKeyword ? 'No rooms found' : 'No rooms available'}
                            </Typography>
                        </Box>
                    )}

                    {roomWorkspaces.map((roomWorkspace) => (
                        <MenuItem
                            key={roomWorkspace._id}
                            onClick={() => handleSelectRoomWorkspace(roomWorkspace)}
                            selected={(currentRoomWorkspace?._id || roomWorkspaceId) === roomWorkspace._id}
                            disableRipple
                        >
                            {roomWorkspace?.fname || roomWorkspace?.name || ''}
                        </MenuItem>
                    ))}

                    {/* Loading More Indicator */}
                    {loadingMore && (
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                            <CircularProgress size={20} />
                        </Box>
                    )}

                    {/* End of List */}
                    {!hasMore && roomWorkspaces.length > 0 && (
                        <Box sx={{ p: 1.5, textAlign: 'center' }}>
                            <Typography variant='caption' color='text.secondary'>
                                {totalCount > 0 ? `${totalCount} room workspace${totalCount > 1 ? 's' : ''}` : 'End of list'}
                            </Typography>
                        </Box>
                    )}
                </ScrollableListContainer>
            </StyledMenu>
        </>
    )
}

export default RoomWorkspaceSwitcher
