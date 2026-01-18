import { useState } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Box,
    Alert,
    CircularProgress,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Checkbox,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material'
import { IconCode, IconRobot, IconTerminal, IconUsers, IconEye, IconDownload } from '@tabler/icons-react'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'

// Components
import PluginViewerDialog from './PluginViewerDialog'

// ==============================|| PLUGIN DISCOVERY DIALOG ||============================== //

const PluginDiscoveryDialog = ({ show, server, onClose, onSuccess, setError }) => {
    const discoverPluginsApi = useApi(claudewsApi.discoverPlugins)
    const [discoveredPlugins, setDiscoveredPlugins] = useState([])
    const [selectedPlugins, setSelectedPlugins] = useState([])
    const [importing, setImporting] = useState(false)
    const [importingPlugin, setImportingPlugin] = useState(null)
    const [step, setStep] = useState('discover') // 'discover' or 'import'
    const [viewingPlugin, setViewingPlugin] = useState(null)
    const [showViewerDialog, setShowViewerDialog] = useState(false)

    const handleDiscover = async () => {
        if (!server) return

        try {
            // Send null/empty to let server use default discovery paths
            const response = await discoverPluginsApi.request(server.id, null)
            console.log('[PluginDiscoveryDialog] Discover response:', response)

            // Handle various response structures - discovered is the actual property
            const plugins = response?.discovered || response?.data?.discovered || response?.plugins || response?.data?.plugins || []
            console.log('[PluginDiscoveryDialog] Extracted plugins:', plugins)

            setDiscoveredPlugins(Array.isArray(plugins) ? plugins : [])
            setStep('import')
        } catch (error) {
            console.error('[PluginDiscoveryDialog] Discover error:', error)
            setError(error)
        }
    }

    const handleTogglePlugin = (plugin) => {
        const pluginKey = `${plugin.type}-${plugin.name}`
        if (selectedPlugins.includes(pluginKey)) {
            setSelectedPlugins(selectedPlugins.filter((key) => key !== pluginKey))
        } else {
            setSelectedPlugins([...selectedPlugins, pluginKey])
        }
    }

    const handleSelectAll = () => {
        const allKeys = discoveredPlugins.map((plugin) => `${plugin.type}-${plugin.name}`)
        setSelectedPlugins(allKeys)
    }

    const handleDeselectAll = () => {
        setSelectedPlugins([])
    }

    const handleViewPlugin = (plugin) => {
        // Convert discovered plugin to format expected by PluginViewerDialog
        const pluginData = {
            id: plugin.name,
            type: plugin.type,
            name: plugin.name,
            description: plugin.description || '',
            sourcePath: plugin.sourcePath,
            storageType: 'discovered',
            metadata: plugin.metadata
        }
        setViewingPlugin(pluginData)
        setShowViewerDialog(true)
    }

    const handleImportSingle = async (plugin) => {
        const pluginKey = `${plugin.type}-${plugin.name}`
        setImportingPlugin(pluginKey)
        try {
            await claudewsApi.importPlugin(server.id, {
                type: plugin.type,
                name: plugin.name,
                sourcePath: plugin.sourcePath,
                storageType: 'imported'
            })
            // Remove from discovered list after successful import
            setDiscoveredPlugins(discoveredPlugins.filter((p) => `${p.type}-${p.name}` !== pluginKey))
            setSelectedPlugins(selectedPlugins.filter((key) => key !== pluginKey))
            onSuccess()
        } catch (error) {
            setError(error)
        } finally {
            setImportingPlugin(null)
        }
    }

    const handleImport = async () => {
        if (selectedPlugins.length === 0) return

        setImporting(true)
        try {
            // Import each selected plugin
            const pluginsToImport = discoveredPlugins.filter((plugin) => selectedPlugins.includes(`${plugin.type}-${plugin.name}`))

            for (const plugin of pluginsToImport) {
                await claudewsApi.importPlugin(server.id, {
                    type: plugin.type,
                    name: plugin.name,
                    sourcePath: plugin.sourcePath,
                    storageType: 'imported'
                })
            }

            // Remove imported plugins from discovered list
            const importedKeys = selectedPlugins
            setDiscoveredPlugins(discoveredPlugins.filter((p) => !importedKeys.includes(`${p.type}-${p.name}`)))
            setSelectedPlugins([])
            onSuccess()

            // Close dialog if all plugins imported
            if (pluginsToImport.length === discoveredPlugins.length) {
                handleClose()
            }
        } catch (error) {
            setError(error)
        } finally {
            setImporting(false)
        }
    }

    const handleImportAll = async () => {
        setImporting(true)
        try {
            for (const plugin of discoveredPlugins) {
                await claudewsApi.importPlugin(server.id, {
                    type: plugin.type,
                    name: plugin.name,
                    sourcePath: plugin.sourcePath,
                    storageType: 'imported'
                })
            }

            onSuccess()
            handleClose()
        } catch (error) {
            setError(error)
        } finally {
            setImporting(false)
        }
    }

    const handleClose = () => {
        setDiscoveredPlugins([])
        setSelectedPlugins([])
        setStep('discover')
        onClose()
    }

    const getPluginIcon = (type) => {
        switch (type) {
            case 'skill':
                return IconCode
            case 'agent':
                return IconRobot
            case 'command':
                return IconTerminal
            case 'agent_set':
                return IconUsers
            default:
                return IconCode
        }
    }

    const getPluginColor = (type) => {
        switch (type) {
            case 'skill':
                return 'primary'
            case 'agent':
                return 'success'
            case 'command':
                return 'warning'
            case 'agent_set':
                return 'info'
            default:
                return 'default'
        }
    }

    return (
        <Dialog open={show} onClose={handleClose} maxWidth='md' fullWidth>
            <DialogTitle>Discover Plugins</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    {step === 'discover' && (
                        <Alert severity='info'>
                            The server will automatically scan for plugins (skills, agents, commands, and agent-sets) in default
                            project directories. The .claude directory is excluded from discovery.
                        </Alert>
                    )}

                    {step === 'import' && (
                        <>
                            <Alert severity='success'>
                                Found {discoveredPlugins.length} plugin{discoveredPlugins.length !== 1 ? 's' : ''}. Select the plugins
                                you want to import.
                            </Alert>

                            {discoveredPlugins.length > 0 && (
                                <Box display='flex' gap={1} justifyContent='space-between' alignItems='center'>
                                    <Box display='flex' gap={1}>
                                        <Button size='small' onClick={handleSelectAll} disabled={importing}>
                                            Select All
                                        </Button>
                                        <Button size='small' onClick={handleDeselectAll} disabled={importing}>
                                            Deselect All
                                        </Button>
                                    </Box>
                                    <Button
                                        size='small'
                                        variant='outlined'
                                        onClick={handleImportAll}
                                        disabled={importing || discoveredPlugins.length === 0}
                                        startIcon={importing ? <CircularProgress size={16} /> : <IconDownload size={16} />}
                                    >
                                        Import All
                                    </Button>
                                </Box>
                            )}

                            {discoveredPlugins.length > 0 ? (
                                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    {discoveredPlugins.map((plugin) => {
                                        const PluginIcon = getPluginIcon(plugin.type)
                                        const pluginKey = `${plugin.type}-${plugin.name}`
                                        const isSelected = selectedPlugins.includes(pluginKey)
                                        const isImporting = importingPlugin === pluginKey

                                        return (
                                            <ListItem
                                                key={pluginKey}
                                                sx={{
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    mb: 1,
                                                    bgcolor: isSelected ? 'action.selected' : 'background.paper'
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <Checkbox
                                                        edge='start'
                                                        checked={isSelected}
                                                        onChange={() => handleTogglePlugin(plugin)}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        disabled={importing}
                                                    />
                                                </ListItemIcon>
                                                <ListItemIcon>
                                                    <PluginIcon size={24} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Box display='flex' alignItems='center' gap={1}>
                                                            <Typography variant='subtitle1'>{plugin.name}</Typography>
                                                            <Chip label={plugin.type} size='small' color={getPluginColor(plugin.type)} />
                                                        </Box>
                                                    }
                                                    secondary={plugin.sourcePath}
                                                />
                                                <Box display='flex' gap={0.5}>
                                                    <Tooltip title='View'>
                                                        <IconButton size='small' onClick={() => handleViewPlugin(plugin)} disabled={importing}>
                                                            <IconEye size={18} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title='Import'>
                                                        <IconButton
                                                            size='small'
                                                            onClick={() => handleImportSingle(plugin)}
                                                            disabled={importing || isImporting}
                                                        >
                                                            {isImporting ? <CircularProgress size={18} /> : <IconDownload size={18} />}
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </ListItem>
                                        )
                                    })}
                                </List>
                            ) : (
                                <Alert severity='warning'>No plugins found. Try adding plugins to your project directories.</Alert>
                            )}

                            {selectedPlugins.length > 0 && (
                                <Typography variant='body2' color='text.secondary'>
                                    {selectedPlugins.length} plugin{selectedPlugins.length !== 1 ? 's' : ''} selected
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={discoverPluginsApi.loading || importing}>
                    Cancel
                </Button>
                {step === 'discover' && (
                    <Button onClick={handleDiscover} variant='contained' disabled={discoverPluginsApi.loading}>
                        {discoverPluginsApi.loading ? <CircularProgress size={20} /> : 'Discover'}
                    </Button>
                )}
                {step === 'import' && (
                    <Button onClick={handleImport} variant='contained' disabled={importing || selectedPlugins.length === 0}>
                        {importing ? <CircularProgress size={20} /> : `Import ${selectedPlugins.length || ''}`}
                    </Button>
                )}
            </DialogActions>

            <PluginViewerDialog
                show={showViewerDialog}
                plugin={viewingPlugin}
                server={server}
                onClose={() => {
                    setShowViewerDialog(false)
                    setViewingPlugin(null)
                }}
                setError={setError}
            />
        </Dialog>
    )
}

PluginDiscoveryDialog.propTypes = {
    show: PropTypes.bool,
    server: PropTypes.object,
    onClose: PropTypes.func,
    onSuccess: PropTypes.func,
    setError: PropTypes.func
}

export default PluginDiscoveryDialog
