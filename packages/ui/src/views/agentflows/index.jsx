import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import PropTypes from 'prop-types'

// material-ui
import { Chip, Box, Stack, ToggleButton, ToggleButtonGroup, IconButton, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import DraggableCard from '@/ui-component/drag-drop/DraggableCard'
import DroppableArea from '@/ui-component/drag-drop/DroppableArea'
import { gridSpacing } from '@/store/constant'
import AgentsEmptySVG from '@/assets/images/agents_empty.svg'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// Folder components
import FolderGrid from '@/ui-component/folder/FolderGrid'
import FolderMenu from '@/ui-component/button/FolderMenu'
import CreateFolderDialog from '@/ui-component/dialog/CreateFolderDialog'
import RenameFolderDialog from '@/ui-component/dialog/RenameFolderDialog'

// API
import chatflowsApi from '@/api/chatflows'
import agentflowFoldersApi from '@/api/agentflow-folders'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { baseURL, AGENTFLOW_ICONS } from '@/store/constant'
import { useError } from '@/store/context/ErrorContext'

// icons
import { IconPlus, IconLayoutGrid, IconList, IconX, IconAlertTriangle, IconFolderPlus, IconDots } from '@tabler/icons-react'

// ==============================|| DROPPABLE BREADCRUMB ||============================== //

const DroppableBreadcrumb = ({ folderId, label, isLast, onClick, dragActiveRef }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `breadcrumb-${folderId || 'root'}`,
        data: { folderId }
    })

    const handleClick = (e) => {
        // Check ref for IMMEDIATE drag state (not stale prop)
        if (dragActiveRef?.current || isOver) {
            e.preventDefault()
            e.stopPropagation()
            return
        }
        onClick?.(e)
    }

    return (
        <Box
            ref={setNodeRef}
            onMouseUp={handleClick}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1.5,
                py: 1,
                borderRadius: 1,
                cursor: isLast ? 'default' : 'pointer',
                backgroundColor: isOver ? 'rgba(255, 204, 128, 0.3)' : 'transparent',
                border: '2px solid ' + (isOver ? 'rgba(255, 204, 128, 0.8)' : 'transparent'),
                transition: 'all 0.2s',
                minWidth: 'fit-content',
                userSelect: 'none'
            }}
        >
            <Typography
                variant='h3'
                sx={{
                    color: isLast ? 'text.primary' : 'primary.main',
                    fontWeight: isLast ? 700 : 500,
                    '&:hover': isLast ? {} : { textDecoration: 'underline' },
                    pointerEvents: 'none'
                }}
            >
                {label}
            </Typography>
        </Box>
    )
}

DroppableBreadcrumb.propTypes = {
    folderId: PropTypes.string,
    label: PropTypes.string.isRequired,
    isLast: PropTypes.bool,
    onClick: PropTypes.func,
    dragActiveRef: PropTypes.shape({
        current: PropTypes.bool
    })
}

// ==============================|| AGENTS ||============================== //

const Agentflows = () => {
    const navigate = useNavigate()
    const { folderId } = useParams()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const [isLoading, setLoading] = useState(true)
    const [images, setImages] = useState({})
    const [icons, setIcons] = useState({})
    const [search, setSearch] = useState('')
    const { error, setError } = useError()

    // Folder state
    const [folders, setFolders] = useState([])
    const [folderMenuAnchor, setFolderMenuAnchor] = useState(null)
    const [selectedFolder, setSelectedFolder] = useState(null)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [isFoldersInitialized, setIsFoldersInitialized] = useState(false)

    // Drag-drop state
    const [activeId, setActiveId] = useState(null)
    const [draggedItem, setDraggedItem] = useState(null)
    const dragActiveRef = useRef(false) // Ref for immediate drag state (doesn't cause re-render)

    // Drag-drop sensors - require 8px movement to trigger drag
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8
            }
        })
    )

    const getAllAgentflows = useApi(chatflowsApi.getAllAgentflows)
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')
    const [agentflowVersion, setAgentflowVersion] = useState(localStorage.getItem('agentFlowVersion') || 'v2')
    const [showDeprecationNotice, setShowDeprecationNotice] = useState(true)

    /* Table Pagination */
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    const onChange = (page, pageLimit) => {
        // Client-side pagination - no API call needed
        setCurrentPage(page)
        setPageLimit(pageLimit)
    }

    const refresh = () => {
        // ALWAYS fetch ALL flows - pagination is done client-side
        // This ensures folder counts are always correct across all pages
        const params = {
            page: 1,
            limit: 999999
        }
        console.log('[Agentflows refresh] Fetching ALL flows for correct folder counts')
        getAllAgentflows.request(agentflowVersion === 'v2' ? 'AGENTFLOW' : 'MULTIAGENT', params)
    }

    const handleChange = (_event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const handleVersionChange = (_event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('agentFlowVersion', nextView)
        setAgentflowVersion(nextView)
        refresh()
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterFlows(data) {
        return (
            data.name.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
            (data.category && data.category.toLowerCase().indexOf(search.toLowerCase()) > -1) ||
            data.id.toLowerCase().indexOf(search.toLowerCase()) > -1
        )
    }

    const addNew = () => {
        // Pass folderId to canvas so new flow gets created in current folder
        const state = selectedFolder ? { folderId: selectedFolder.id } : undefined
        if (agentflowVersion === 'v2') {
            navigate('/v2/agentcanvas', { state })
        } else {
            navigate('/agentcanvas', { state })
        }
    }

    const goToCanvas = (selectedAgentflow) => {
        if (selectedAgentflow.type === 'AGENTFLOW') {
            navigate(`/v2/agentcanvas/${selectedAgentflow.id}`)
        } else {
            navigate(`/agentcanvas/${selectedAgentflow.id}`)
        }
    }

    const handleDismissDeprecationNotice = () => {
        setShowDeprecationNotice(false)
    }

    // Folder functions
    const loadFolders = async () => {
        try {
            const response = await agentflowFoldersApi.getAllFolders()
            const data = response.data
            setFolders(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Failed to load folders:', err)
            setFolders([])
        }
    }

    const handleCreateFolder = async (name) => {
        try {
            // If in folder view, create as subfolder
            const payload = selectedFolder ? { name, parentId: selectedFolder.id } : { name }
            await agentflowFoldersApi.createFolder(payload)
            await loadFolders()
            setCreateDialogOpen(false)
        } catch (err) {
            console.error('Failed to create folder:', err)
        }
    }

    const handleRenameFolder = async (name) => {
        try {
            await agentflowFoldersApi.updateFolder(selectedFolder.id, { name })
            await loadFolders()
            setRenameDialogOpen(false)
            // Update selectedFolder name immediately to avoid breadcrumb flicker
            setSelectedFolder((prev) => ({ ...prev, name }))
        } catch (err) {
            console.error('Failed to rename folder:', err)
        }
    }

    const handleDeleteFolder = async () => {
        try {
            await agentflowFoldersApi.deleteFolder(selectedFolder.id)
            setSelectedFolder(null) // Clear immediately
            setFolderMenuAnchor(null)
            navigate('/agentflows')
            await loadFolders() // Reload after navigation
        } catch (err) {
            console.error('Failed to delete folder:', err)
        }
    }

    const handleFolderClick = (folder) => {
        setSelectedFolder(folder) // Update immediately
        navigate(`/agentflows/${folder.id}`)
    }

    // Build breadcrumb path from root to current folder
    const getBreadcrumbPath = () => {
        if (!selectedFolder) return []
        const path = []
        let current = selectedFolder
        while (current) {
            path.unshift(current)
            current = folders.find((f) => f.id === current.parentId)
        }
        return path
    }

    // Filter agentflows by selected folder with client-side pagination
    const getFilteredAgentflows = () => {
        const allFlows = getAllAgentflows.data?.data || []
        const filtered = !selectedFolder
            ? allFlows.filter((flow) => !flow.folderId) // Show only unassigned
            : allFlows.filter((flow) => flow.folderId === selectedFolder.id) // Show folder flows

        // In main view, apply client-side pagination
        // In folder view, show all flows (no pagination)
        const startIndex = selectedFolder ? 0 : (currentPage - 1) * pageLimit
        const endIndex = selectedFolder ? filtered.length : startIndex + pageLimit
        const paginated = filtered.slice(startIndex, endIndex)

        console.log(
            '[getFilteredAgentflows] selectedFolder:',
            selectedFolder?.name,
            'allFlows:',
            allFlows.length,
            'filtered:',
            filtered.length,
            'paginated:',
            paginated.length,
            'page:',
            currentPage,
            'limit:',
            pageLimit
        )
        return paginated
    }

    // Get ALL filtered flows (without pagination) for folder counts
    const getAllFilteredAgentflows = () => {
        const allFlows = getAllAgentflows.data?.data || []
        return !selectedFolder ? allFlows.filter((flow) => !flow.folderId) : allFlows.filter((flow) => flow.folderId === selectedFolder.id)
    }

    // Get count of flows in a specific folder (for FolderGrid)
    const getFolderFlowCount = (folderId) => {
        const allFlows = getAllAgentflows.data?.data || []
        return allFlows.filter((flow) => flow.folderId === folderId).length
    }

    // Sync folderId from URL to selectedFolder state
    useEffect(() => {
        if (!isFoldersInitialized || folders.length === 0) return
        if (folderId) {
            const folder = folders.find((f) => f.id === folderId)
            if (folder) {
                setSelectedFolder(folder)
            } else {
                // Invalid folderId - redirect to root
                console.warn(`Folder not found: ${folderId}`)
                navigate('/agentflows', { replace: true })
            }
        } else {
            setSelectedFolder(null)
        }
    }, [folderId, folders, isFoldersInitialized, navigate, setSelectedFolder])

    // Drag-drop handlers
    const handleDragStart = (event) => {
        setActiveId(event.active.id)
        dragActiveRef.current = true // Set ref immediately
        const item = getAllAgentflows.data?.data.find((f) => f.id === event.active.id)
        setDraggedItem(item)
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        setActiveId(null)
        setDraggedItem(null)

        // Clear ref after a delay to prevent click events from firing
        setTimeout(() => {
            dragActiveRef.current = false
        }, 100)

        if (!over || active.id === over.id) return

        // Only proceed if dragging an actual agentflow
        const draggedAgentflow = getAllAgentflows.data?.data.find((f) => f.id === active.id)
        if (!draggedAgentflow) return

        // Check if dropped on a breadcrumb folder
        if (over.id && over.id.toString().startsWith('breadcrumb-')) {
            // Extract folderId from breadcrumb ID (e.g., "breadcrumb-xxx" or "breadcrumb-root")
            const folderId = over.id === 'breadcrumb-root' ? null : over.id.replace('breadcrumb-', '')
            try {
                await agentflowFoldersApi.moveChatflowToFolder(active.id, { folderId })
                await Promise.all([loadFolders(), refresh()])
            } catch (err) {
                console.error('Failed to move agentflow to folder:', err)
            }
            return
        }

        // Check if dropped on a folder card or unassigned area
        const folder = folders.find((f) => f.id === over.id)
        if (folder) {
            try {
                await agentflowFoldersApi.moveChatflowToFolder(active.id, { folderId: folder.id })
                await Promise.all([loadFolders(), refresh()])
            } catch (err) {
                console.error('Failed to move agentflow:', err)
            }
        } else if (over.id === 'unassigned') {
            // Move to unassigned (remove from folder)
            try {
                await agentflowFoldersApi.moveChatflowToFolder(active.id, { folderId: null })
                await Promise.all([loadFolders(), refresh()])
            } catch (err) {
                console.error('Failed to remove agentflow from folder:', err)
            }
        }
    }

    useEffect(() => {
        const initializeFolders = async () => {
            refresh()
            await loadFolders()
            setIsFoldersInitialized(true)
        }
        initializeFolders()

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Reset page when entering folder view (client-side pagination)
    useEffect(() => {
        if (selectedFolder) {
            setCurrentPage(1)
        }
    }, [selectedFolder])

    useEffect(() => {
        if (getAllAgentflows.error) {
            setError(getAllAgentflows.error)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllAgentflows.error])

    useEffect(() => {
        setLoading(getAllAgentflows.loading)
    }, [getAllAgentflows.loading])

    useEffect(() => {
        if (getAllAgentflows.data) {
            try {
                const agentflows = getAllAgentflows.data?.data
                // Use filtered count for total (client-side pagination)
                const filteredCount = getAllFilteredAgentflows().length
                setTotal(filteredCount)
                const images = {}
                const icons = {}
                for (let i = 0; i < agentflows.length; i += 1) {
                    const flowDataStr = agentflows[i].flowData
                    const flowData = JSON.parse(flowDataStr)
                    const nodes = flowData.nodes || []
                    images[agentflows[i].id] = []
                    icons[agentflows[i].id] = []
                    for (let j = 0; j < nodes.length; j += 1) {
                        if (nodes[j].data.name === 'stickyNote' || nodes[j].data.name === 'stickyNoteAgentflow') continue
                        const foundIcon = AGENTFLOW_ICONS.find((icon) => icon.name === nodes[j].data.name)
                        if (foundIcon) {
                            icons[agentflows[i].id].push(foundIcon)
                        } else {
                            const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                            if (!images[agentflows[i].id].some((img) => img.imageSrc === imageSrc)) {
                                images[agentflows[i].id].push({
                                    imageSrc,
                                    label: nodes[j].data.label
                                })
                            }
                        }
                    }
                }
                setImages(images)
                setIcons(icons)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllAgentflows.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <>
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder='Search Name or Category'
                            title='Agentflows'
                            description='Multi-agent systems, workflow orchestration'
                        >
                            <ToggleButtonGroup
                                sx={{ borderRadius: 2, maxHeight: 40 }}
                                value={agentflowVersion}
                                color='primary'
                                exclusive
                                onChange={handleVersionChange}
                            >
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: customization.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='v2'
                                    title='V2'
                                >
                                    <Chip sx={{ mr: 1 }} label='NEW' size='small' color='primary' />
                                    V2
                                </ToggleButton>
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: customization.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='v1'
                                    title='V1'
                                >
                                    V1
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <ToggleButtonGroup
                                sx={{ borderRadius: 2, maxHeight: 40 }}
                                value={view}
                                disabled={total === 0}
                                color='primary'
                                exclusive
                                onChange={handleChange}
                            >
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: customization.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='card'
                                    title='Card View'
                                >
                                    <IconLayoutGrid />
                                </ToggleButton>
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: customization.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='list'
                                    title='List View'
                                >
                                    <IconList />
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <StyledPermissionButton
                                permissionId={'agentflows:create'}
                                variant='outlined'
                                onClick={() => setCreateDialogOpen(true)}
                                startIcon={<IconFolderPlus />}
                                sx={{ borderRadius: 2, height: 40 }}
                            >
                                New Folder
                            </StyledPermissionButton>
                            <StyledPermissionButton
                                permissionId={'agentflows:create'}
                                variant='contained'
                                onClick={addNew}
                                startIcon={<IconPlus />}
                                sx={{ borderRadius: 2, height: 40 }}
                            >
                                New AgentFlow
                            </StyledPermissionButton>
                        </ViewHeader>

                        {/* Deprecation Notice For V1 */}
                        {agentflowVersion === 'v1' && showDeprecationNotice && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 2,
                                    background: customization.isDarkMode
                                        ? 'linear-gradient(135deg,rgba(165, 128, 6, 0.31) 0%, #ffcc802f 100%)'
                                        : 'linear-gradient(135deg, #fff8e17a 0%, #ffcc804a 100%)',
                                    color: customization.isDarkMode ? 'white' : '#333333',
                                    fontWeight: 400,
                                    borderRadius: 2,
                                    gap: 1.5
                                }}
                            >
                                <IconAlertTriangle
                                    size={20}
                                    style={{
                                        color: customization.isDarkMode ? '#ffcc80' : '#f57c00',
                                        flexShrink: 0
                                    }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <strong>V1 Agentflows are deprecated.</strong> We recommend migrating to V2 for improved performance and
                                    continued support.
                                </Box>
                                <IconButton
                                    aria-label='dismiss'
                                    size='small'
                                    onClick={handleDismissDeprecationNotice}
                                    sx={{
                                        color: customization.isDarkMode ? '#ffcc80' : '#f57c00',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 204, 128, 0.1)'
                                        }
                                    }}
                                >
                                    <IconX size={16} />
                                </IconButton>
                            </Box>
                        )}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Folder Breadcrumb - always show droppable target */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                {selectedFolder ? (
                                    <>
                                        {/* Root level - Agentflows (droppable) */}
                                        <DroppableBreadcrumb
                                            folderId={null}
                                            label='Agentflows'
                                            isLast={false}
                                            onClick={() => navigate('/agentflows')}
                                            dragActiveRef={dragActiveRef}
                                        />
                                        {/* Breadcrumb path */}
                                        {getBreadcrumbPath().map((folder, index) => (
                                            <Box key={folder.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant='h3' color='text.secondary'>
                                                    /
                                                </Typography>
                                                <DroppableBreadcrumb
                                                    key={folder.id}
                                                    folderId={folder.id}
                                                    label={folder.name}
                                                    isLast={index === getBreadcrumbPath().length - 1}
                                                    onClick={() =>
                                                        index < getBreadcrumbPath().length - 1 && navigate(`/agentflows/${folder.id}`)
                                                    }
                                                    dragActiveRef={dragActiveRef}
                                                />
                                            </Box>
                                        ))}
                                        {/* Agentflow count */}
                                        <Typography variant='h5' color='text.secondary' sx={{ ml: 1 }}>
                                            ({getFilteredAgentflows().filter(filterFlows).length} agentflows)
                                        </Typography>
                                        {/* Settings menu */}
                                        <Box sx={{ flex: 1 }} />
                                        <IconButton size='small' onClick={(e) => setFolderMenuAnchor(e.currentTarget)} sx={{ ml: 1 }}>
                                            <IconDots size={20} />
                                        </IconButton>
                                    </>
                                ) : (
                                    <>
                                        {/* Main view - just show droppable Agentflows */}
                                        <DroppableBreadcrumb
                                            folderId={null}
                                            label='Agentflows'
                                            isLast={true}
                                            onClick={() => navigate('/agentflows')}
                                            dragActiveRef={dragActiveRef}
                                        />
                                        {/* Agentflow count */}
                                        <Typography variant='h5' color='text.secondary' sx={{ ml: 1 }}>
                                            ({getFilteredAgentflows().filter(filterFlows).length} agentflows)
                                        </Typography>
                                        <Box sx={{ flex: 1 }} />
                                    </>
                                )}
                            </Box>
                            {/* Folders Section - show root folders when not in folder view, or subfolders when in folder view */}
                            {!isLoading && (
                                <FolderGrid
                                    folders={
                                        selectedFolder
                                            ? folders.filter((f) => f.parentId === selectedFolder.id) // Show subfolders
                                            : folders.filter((f) => !f.parentId) // Show only root folders
                                    }
                                    getFlowCount={getFolderFlowCount}
                                    onFolderClick={handleFolderClick}
                                />
                            )}
                            {!isLoading && getFilteredAgentflows().length > 0 && (
                                <>
                                    {/* Section Header for Agentflows */}
                                    <Typography variant='h4' sx={{ mb: 2, fontWeight: 700, color: 'text.primary' }}>
                                        Agentflows
                                    </Typography>
                                    {!view || view === 'card' ? (
                                        <DroppableArea id='unassigned'>
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {getFilteredAgentflows()
                                                    .filter(filterFlows)
                                                    .map((data) => (
                                                        <DraggableCard key={data.id} id={data.id}>
                                                            <ItemCard
                                                                onClick={() => goToCanvas(data)}
                                                                data={data}
                                                                images={images[data.id]}
                                                                icons={icons[data.id]}
                                                            />
                                                        </DraggableCard>
                                                    ))}
                                            </Box>
                                        </DroppableArea>
                                    ) : (
                                        <FlowListTable
                                            isAgentCanvas={true}
                                            isAgentflowV2={agentflowVersion === 'v2'}
                                            data={getFilteredAgentflows()}
                                            images={images}
                                            icons={icons}
                                            isLoading={isLoading}
                                            filterFunction={filterFlows}
                                            updateFlowsApi={getAllAgentflows}
                                            setError={setError}
                                        />
                                    )}
                                    {/* Pagination and Page Size Controls - only show in main view */}
                                    {!selectedFolder && (
                                        <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                                    )}
                                </>
                            )}

                            {!isLoading && getFilteredAgentflows().length === 0 && (
                                <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                    <Box sx={{ p: 2, height: 'auto' }}>
                                        <img
                                            style={{ objectFit: 'cover', height: '12vh', width: 'auto' }}
                                            src={AgentsEmptySVG}
                                            alt='AgentsEmptySVG'
                                        />
                                    </Box>
                                    <div>No Agents Yet</div>
                                </Stack>
                            )}
                            <DragOverlay>
                                {activeId && draggedItem && (
                                    <ItemCard data={draggedItem} images={images[activeId]} icons={icons[activeId]} />
                                )}
                            </DragOverlay>
                        </DndContext>
                    </Stack>
                    {/* Folder Dialogs */}
                    <FolderMenu
                        anchorEl={folderMenuAnchor}
                        onClose={() => setFolderMenuAnchor(null)}
                        onRename={() => {
                            setRenameDialogOpen(true)
                            setFolderMenuAnchor(null)
                        }}
                        onDelete={handleDeleteFolder}
                    />
                    <CreateFolderDialog
                        open={createDialogOpen}
                        onClose={() => setCreateDialogOpen(false)}
                        onSubmit={handleCreateFolder}
                        parentFolderName={selectedFolder?.name || null}
                    />
                    <RenameFolderDialog
                        open={renameDialogOpen}
                        onClose={() => {
                            setRenameDialogOpen(false)
                            setSelectedFolder(null)
                        }}
                        onSubmit={handleRenameFolder}
                        folderName={selectedFolder?.name || ''}
                    />
                    <ConfirmDialog />
                </>
            )}
        </MainCard>
    )
}

export default Agentflows
