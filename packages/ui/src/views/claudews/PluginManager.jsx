import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Stack,
    Typography,
    Button,
    Card,
    CardContent,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Chip,
    Grid,
    IconButton,
    Tooltip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import {
    IconUpload,
    IconRefresh,
    IconSearch,
    IconFolder,
    IconCode,
    IconRobot,
    IconTerminal,
    IconUsers,
    IconEye,
    IconTrash
} from '@tabler/icons-react'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// Components
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import PluginUploadDialog from './PluginUploadDialog'
import PluginDiscoveryDialog from './PluginDiscoveryDialog'
import PluginViewerDialog from './PluginViewerDialog'

// ==============================|| PLUGIN MANAGER ||============================== //

const PluginManager = ({ server, setError }) => {
    const theme = useTheme()
    const { confirm } = useConfirm()
    const listPluginsApi = useApi(claudewsApi.listPlugins)

    const [plugins, setPlugins] = useState([])
    const [filteredPlugins, setFilteredPlugins] = useState([])
    const [currentTab, setCurrentTab] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [showDiscoveryDialog, setShowDiscoveryDialog] = useState(false)
    const [showDetailsDialog, setShowDetailsDialog] = useState(false)
    const [selectedPlugin, setSelectedPlugin] = useState(null)

    const loadPlugins = async () => {
        if (!server) return
        try {
            const response = await listPluginsApi.request(server.id, currentTab === 'all' ? null : currentTab)
            setPlugins(response.data || [])
        } catch (error) {
            setError(error)
        }
    }

    useEffect(() => {
        loadPlugins()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server, currentTab])

    useEffect(() => {
        // Filter plugins by search query
        if (!searchQuery) {
            setFilteredPlugins(plugins)
        } else {
            const query = searchQuery.toLowerCase()
            setFilteredPlugins(
                plugins.filter(
                    (plugin) =>
                        plugin.name?.toLowerCase().includes(query) ||
                        plugin.description?.toLowerCase().includes(query) ||
                        plugin.type?.toLowerCase().includes(query)
                )
            )
        }
    }, [plugins, searchQuery])

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue)
        setSearchQuery('')
    }

    const handleViewDetails = (plugin) => {
        setSelectedPlugin(plugin)
        setShowDetailsDialog(true)
    }

    const handleDeletePlugin = async (plugin) => {
        console.log('[PluginManager] Delete clicked for plugin:', plugin)
        try {
            const isConfirmed = await confirm({
                title: 'Delete Plugin',
                description: `Are you sure you want to delete plugin "${plugin.name}"? This action cannot be undone.`,
                confirmButtonName: 'Delete',
                cancelButtonName: 'Cancel'
            })

            console.log('[PluginManager] Confirmation result:', isConfirmed)

            if (isConfirmed) {
                const pluginId = plugin.id || plugin.name
                console.log('[PluginManager] Deleting plugin with ID:', pluginId)
                await claudewsApi.deletePlugin(server.id, pluginId)
                console.log('[PluginManager] Plugin deleted successfully')
                loadPlugins()
            }
        } catch (error) {
            console.error('[PluginManager] Delete error:', error)
            setError(error)
        }
    }

    const getPluginIcon = (type) => {
        switch (type) {
            case 'skill':
                return IconCode
            case 'agent':
                return IconRobot
            case 'command':
                return IconTerminal
            case 'agent-set':
                return IconUsers
            default:
                return IconFolder
        }
    }

    const getPluginColor = (type) => {
        switch (type) {
            case 'skill':
                return theme.palette.primary.main
            case 'agent':
                return theme.palette.success.main
            case 'command':
                return theme.palette.warning.main
            case 'agent-set':
                return theme.palette.info.main
            default:
                return theme.palette.grey[500]
        }
    }

    if (!server) {
        return (
            <Card sx={{ borderRadius: 2, textAlign: 'center', py: 8 }}>
                <CardContent>
                    <IconFolder size={64} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <Typography variant='h5' gutterBottom>
                        No Server Selected
                    </Typography>
                    <Typography variant='body2' color='textSecondary'>
                        Select a server from the list to manage its plugins
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={2}>
            <Box display='flex' justifyContent='space-between' alignItems='center'>
                <Typography variant='h4'>Plugin Manager</Typography>
                <Box display='flex' gap={1}>
                    <Tooltip title='Refresh'>
                        <IconButton size='small' onClick={loadPlugins}>
                            <IconRefresh size={18} />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant='outlined'
                        startIcon={<IconFolder />}
                        onClick={() => setShowDiscoveryDialog(true)}
                        sx={{ borderRadius: 2 }}
                    >
                        Discover
                    </Button>
                    <Button
                        variant='contained'
                        startIcon={<IconUpload />}
                        onClick={() => setShowUploadDialog(true)}
                        sx={{ borderRadius: 2 }}
                    >
                        Upload
                    </Button>
                </Box>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={currentTab} onChange={handleTabChange}>
                    <Tab label='All' value='all' />
                    <Tab label='Skills' value='skill' />
                    <Tab label='Agents' value='agent' />
                    <Tab label='Commands' value='command' />
                    <Tab label='Agent Sets' value='agent-set' />
                </Tabs>
            </Box>

            <TextField
                placeholder='Search plugins...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start'>
                            <IconSearch size={20} />
                        </InputAdornment>
                    )
                }}
                sx={{ mb: 2 }}
            />

            {listPluginsApi.loading ? (
                <Typography>Loading plugins...</Typography>
            ) : filteredPlugins.length === 0 ? (
                <Card sx={{ borderRadius: 2, textAlign: 'center', py: 4 }}>
                    <CardContent>
                        <IconFolder size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                        <Typography variant='body2' color='textSecondary'>
                            {searchQuery ? 'No plugins match your search' : 'No plugins found'}
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Grid container spacing={2}>
                    {filteredPlugins.map((plugin) => {
                        const PluginIcon = getPluginIcon(plugin.type)
                        return (
                            <Grid item xs={12} sm={6} md={4} key={plugin.name}>
                                <Card
                                    sx={{
                                        borderRadius: 2,
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        border: 1,
                                        borderColor: theme.palette.grey[300],
                                        '&:hover': {
                                            boxShadow: 3
                                        }
                                    }}
                                >
                                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box display='flex' alignItems='center' gap={1}>
                                            <PluginIcon size={24} color={getPluginColor(plugin.type)} />
                                            <Typography variant='h6' sx={{ flex: 1, wordBreak: 'break-word' }}>
                                                {plugin.name}
                                            </Typography>
                                        </Box>

                                        <Box display='flex' gap={0.5} flexWrap='wrap'>
                                            <Chip label={plugin.type} size='small' color='primary' sx={{ height: 20 }} />
                                        </Box>

                                        {plugin.description && (
                                            <Typography
                                                variant='body2'
                                                color='textSecondary'
                                                sx={{
                                                    flex: 1,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {plugin.description}
                                            </Typography>
                                        )}

                                        <Box display='flex' gap={0.5} justifyContent='flex-end' mt='auto'>
                                            <Tooltip title='View Details'>
                                                <IconButton size='small' onClick={() => handleViewDetails(plugin)}>
                                                    <IconEye size={16} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='Delete'>
                                                <IconButton size='small' color='error' onClick={() => handleDeletePlugin(plugin)}>
                                                    <IconTrash size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )
                    })}
                </Grid>
            )}

            <PluginUploadDialog
                show={showUploadDialog}
                server={server}
                onClose={() => setShowUploadDialog(false)}
                onSuccess={loadPlugins}
                setError={setError}
            />

            <PluginDiscoveryDialog
                show={showDiscoveryDialog}
                server={server}
                onClose={() => setShowDiscoveryDialog(false)}
                onSuccess={loadPlugins}
                setError={setError}
            />

            <PluginViewerDialog
                show={showDetailsDialog}
                plugin={selectedPlugin}
                server={server}
                onClose={() => {
                    setShowDetailsDialog(false)
                    setSelectedPlugin(null)
                }}
                setError={setError}
            />

            <ConfirmDialog />
        </Stack>
    )
}

PluginManager.propTypes = {
    server: PropTypes.object,
    setError: PropTypes.func.isRequired
}

export default PluginManager
