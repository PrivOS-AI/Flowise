import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Dialog,
    DialogContent,
    DialogTitle,
    Box,
    Typography,
    Chip,
    Tabs,
    Tab,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    Paper
} from '@mui/material'
import { IconX, IconFile, IconPackage } from '@tabler/icons-react'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'

// ==============================|| PLUGIN DETAILS DIALOG ||============================== //

const PluginDetailsDialog = ({ show, plugin, server, onClose, setError }) => {
    const getPluginApi = useApi(claudewsApi.getPlugin)
    const [pluginDetails, setPluginDetails] = useState(null)
    const [currentTab, setCurrentTab] = useState(0)

    useEffect(() => {
        if (show && plugin && server) {
            loadPluginDetails()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, plugin, server])

    const loadPluginDetails = async () => {
        try {
            const response = await getPluginApi.request(server.id, plugin.name)
            setPluginDetails(response.data)
        } catch (error) {
            setError(error)
        }
    }

    const handleClose = () => {
        setPluginDetails(null)
        setCurrentTab(0)
        onClose()
    }

    if (!plugin) return null

    return (
        <Dialog open={show} onClose={handleClose} maxWidth='md' fullWidth>
            <DialogTitle>
                <Box display='flex' justifyContent='space-between' alignItems='center'>
                    <Box>
                        <Typography variant='h5'>{plugin.name}</Typography>
                        <Box display='flex' gap={1} mt={1}>
                            <Chip label={plugin.type} size='small' color='primary' />
                        </Box>
                    </Box>
                    <IconButton onClick={handleClose}>
                        <IconX />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {getPluginApi.loading ? (
                    <Typography>Loading details...</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {plugin.description && (
                            <Box>
                                <Typography variant='subtitle2' gutterBottom>
                                    Description
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    {plugin.description}
                                </Typography>
                            </Box>
                        )}

                        <Divider />

                        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
                            <Tab label='Overview' />
                            <Tab label='Files' />
                            <Tab label='Dependencies' />
                        </Tabs>

                        {currentTab === 0 && (
                            <Box>
                                <Typography variant='subtitle2' gutterBottom>
                                    Plugin Information
                                </Typography>
                                <Paper variant='outlined' sx={{ p: 2 }}>
                                    <Box display='flex' flexDirection='column' gap={1}>
                                        <Box display='flex' justifyContent='space-between'>
                                            <Typography variant='body2' color='textSecondary'>
                                                Name:
                                            </Typography>
                                            <Typography variant='body2'>{plugin.name}</Typography>
                                        </Box>
                                        <Box display='flex' justifyContent='space-between'>
                                            <Typography variant='body2' color='textSecondary'>
                                                Type:
                                            </Typography>
                                            <Typography variant='body2'>{plugin.type}</Typography>
                                        </Box>
                                        {pluginDetails?.version && (
                                            <Box display='flex' justifyContent='space-between'>
                                                <Typography variant='body2' color='textSecondary'>
                                                    Version:
                                                </Typography>
                                                <Typography variant='body2'>{pluginDetails.version}</Typography>
                                            </Box>
                                        )}
                                        {pluginDetails?.author && (
                                            <Box display='flex' justifyContent='space-between'>
                                                <Typography variant='body2' color='textSecondary'>
                                                    Author:
                                                </Typography>
                                                <Typography variant='body2'>{pluginDetails.author}</Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </Paper>
                            </Box>
                        )}

                        {currentTab === 1 && (
                            <Box>
                                <Typography variant='subtitle2' gutterBottom>
                                    Plugin Files
                                </Typography>
                                {pluginDetails?.files && pluginDetails.files.length > 0 ? (
                                    <List>
                                        {pluginDetails.files.map((file, index) => (
                                            <ListItem key={index} divider>
                                                <IconFile size={20} style={{ marginRight: 8 }} />
                                                <ListItemText primary={file} />
                                            </ListItem>
                                        ))}
                                    </List>
                                ) : (
                                    <Typography variant='body2' color='textSecondary'>
                                        No file information available
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {currentTab === 2 && (
                            <Box>
                                <Typography variant='subtitle2' gutterBottom>
                                    Dependencies
                                </Typography>
                                {pluginDetails?.dependencies && pluginDetails.dependencies.length > 0 ? (
                                    <List>
                                        {pluginDetails.dependencies.map((dep, index) => (
                                            <ListItem key={index} divider>
                                                <IconPackage size={20} style={{ marginRight: 8 }} />
                                                <ListItemText primary={dep.name} secondary={dep.version} />
                                            </ListItem>
                                        ))}
                                    </List>
                                ) : (
                                    <Typography variant='body2' color='textSecondary'>
                                        No dependencies
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    )
}

PluginDetailsDialog.propTypes = {
    show: PropTypes.bool,
    plugin: PropTypes.object,
    server: PropTypes.object,
    onClose: PropTypes.func,
    setError: PropTypes.func
}

export default PluginDetailsDialog
