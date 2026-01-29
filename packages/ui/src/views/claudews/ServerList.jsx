import { useState } from 'react'
import PropTypes from 'prop-types'

// material-ui
import { Box, Stack, Button, Card, CardContent, Typography, Chip, IconButton, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import { IconPlus, IconRefresh, IconEdit, IconTrash, IconCircleCheck, IconCircleX, IconServer } from '@tabler/icons-react'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// ==============================|| SERVER LIST ||============================== //

const ServerList = ({ servers, selectedServer, onSelect, onAdd, onEdit, onRefresh, setError }) => {
    const theme = useTheme()
    const { confirm } = useConfirm()
    const deleteServerApi = useApi(claudewsApi.deleteServer)

    const handleDelete = async (server, e) => {
        e.stopPropagation()
        const isConfirmed = await confirm({
            title: 'Delete Server',
            description: `Are you sure you want to delete "${server.name}"? This will remove all plugin configurations.`,
            confirmButtonName: 'Delete',
            cancelButtonName: 'Cancel'
        })

        if (isConfirmed) {
            try {
                await deleteServerApi.request(server.id)
                onRefresh()
            } catch (error) {
                if (error) {
                    setError(error)
                }
            }
        }
    }

    const handleEdit = (server, e) => {
        e.stopPropagation()
        onEdit(server)
    }

    return (
        <Stack spacing={2}>
            <Box display='flex' justifyContent='space-between' alignItems='center'>
                <Typography variant='h4'>Servers</Typography>
                <Box display='flex' gap={1}>
                    <Tooltip title='Refresh'>
                        <IconButton size='small' onClick={onRefresh}>
                            <IconRefresh size={18} />
                        </IconButton>
                    </Tooltip>
                    <Button variant='contained' startIcon={<IconPlus />} onClick={onAdd} sx={{ borderRadius: 2 }}>
                        Add Server
                    </Button>
                </Box>
            </Box>

            {servers.length === 0 ? (
                <Card sx={{ borderRadius: 2, textAlign: 'center', py: 4 }}>
                    <CardContent>
                        <IconServer size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                        <Typography variant='body2' color='textSecondary'>
                            No servers configured yet
                        </Typography>
                        <Button variant='outlined' onClick={onAdd} sx={{ mt: 2, borderRadius: 2 }}>
                            Add Your First Server
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                servers.map((server) => (
                    <Card
                        key={server.id}
                        onClick={() => onSelect(server)}
                        sx={{
                            borderRadius: 2,
                            cursor: 'pointer',
                            border: selectedServer?.id === server.id ? 2 : 1,
                            borderColor: selectedServer?.id === server.id ? theme.palette.primary.main : theme.palette.grey[300],
                            '&:hover': {
                                boxShadow: 3,
                                borderColor: theme.palette.primary.main
                            }
                        }}
                    >
                        <CardContent>
                            <Box display='flex' justifyContent='space-between' alignItems='flex-start'>
                                <Box flex={1}>
                                    <Box display='flex' alignItems='center' gap={1} mb={1}>
                                        <Typography variant='h5'>{server.name}</Typography>
                                        {server.isActive ? (
                                            <Chip
                                                icon={<IconCircleCheck size={14} />}
                                                label='Active'
                                                size='small'
                                                color='success'
                                                sx={{ height: 20 }}
                                            />
                                        ) : (
                                            <Chip
                                                icon={<IconCircleX size={14} />}
                                                label='Inactive'
                                                size='small'
                                                color='default'
                                                sx={{ height: 20 }}
                                            />
                                        )}
                                    </Box>
                                    {server.description && (
                                        <Typography variant='body2' color='textSecondary' mb={1}>
                                            {server.description}
                                        </Typography>
                                    )}
                                    <Box display='flex' gap={1} flexWrap='wrap'>
                                        {!server.roomId ? (
                                            <Chip label='Global' size='small' color='primary' sx={{ height: 20 }} />
                                        ) : (
                                            <Chip label='My Room' size='small' color='secondary' sx={{ height: 20 }} />
                                        )}
                                    </Box>
                                </Box>
                                <Box display='flex' gap={0.5}>
                                    <Tooltip title='Edit'>
                                        <IconButton size='small' onClick={(e) => handleEdit(server, e)}>
                                            <IconEdit size={16} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title='Delete'>
                                        <IconButton size='small' color='error' onClick={(e) => handleDelete(server, e)}>
                                            <IconTrash size={16} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                ))
            )}
        </Stack>
    )
}

ServerList.propTypes = {
    servers: PropTypes.array.isRequired,
    selectedServer: PropTypes.object,
    onSelect: PropTypes.func.isRequired,
    onAdd: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    setError: PropTypes.func.isRequired
}

export default ServerList
