import { useEffect, useState } from 'react'

// material-ui
import { Box, Grid, Stack, Skeleton } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import ServerList from './ServerList'
import PluginManager from './PluginManager'
import ServerDialog from './ServerDialog'

// API
import claudewsApi from '@/api/claudews'

// Hooks
import useApi from '@/hooks/useApi'
import { useError } from '@/store/context/ErrorContext'
import { gridSpacing } from '@/store/constant'

// ==============================|| CLAUDEWS SERVERS ||============================== //

const ClaudeWS = () => {
    const theme = useTheme()
    const getAllServersApi = useApi(claudewsApi.getAllServers)
    const { error, setError } = useError()

    const [isLoading, setLoading] = useState(true)
    const [showServerDialog, setShowServerDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [selectedServer, setSelectedServer] = useState(null)
    const [servers, setServers] = useState([])

    const refresh = () => {
        getAllServersApi.request()
    }

    const addNew = () => {
        const dialogProp = {
            title: 'Add ClaudeWS Server',
            type: 'ADD',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'Add'
        }
        setDialogProps(dialogProp)
        setShowServerDialog(true)
    }

    const edit = (server) => {
        const dialogProp = {
            title: 'Edit ClaudeWS Server',
            type: 'EDIT',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'Save',
            data: server
        }
        setDialogProps(dialogProp)
        setShowServerDialog(true)
    }

    const onServerDialogConfirm = () => {
        setShowServerDialog(false)
        refresh()
    }

    const onSelectServer = (server) => {
        setSelectedServer(server)
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getAllServersApi.loading)
    }, [getAllServersApi.loading])

    useEffect(() => {
        if (getAllServersApi.data) {
            setServers(getAllServersApi.data)
            // Auto-select first server if none selected
            if (!selectedServer && getAllServersApi.data.length > 0) {
                setSelectedServer(getAllServersApi.data[0])
            }
        }
    }, [getAllServersApi.data])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader title='ClaudeWS Servers' description='AI Agentic Workspace Powered by Claude Agent'>
                            {/* Additional header buttons can go here */}
                        </ViewHeader>

                        <Grid container spacing={gridSpacing}>
                            {/* Left Panel - Server List */}
                            <Grid item xs={12} md={4}>
                                {isLoading ? (
                                    <Box display='flex' flexDirection='column' gap={2}>
                                        <Skeleton variant='rounded' height={160} />
                                        <Skeleton variant='rounded' height={160} />
                                    </Box>
                                ) : (
                                    <ServerList
                                        servers={servers}
                                        selectedServer={selectedServer}
                                        onSelect={onSelectServer}
                                        onAdd={addNew}
                                        onEdit={edit}
                                        onRefresh={refresh}
                                        setError={setError}
                                    />
                                )}
                            </Grid>

                            {/* Right Panel - Plugin Manager */}
                            <Grid item xs={12} md={8}>
                                {isLoading ? (
                                    <Skeleton variant='rounded' height={600} />
                                ) : (
                                    <PluginManager server={selectedServer} setError={setError} />
                                )}
                            </Grid>
                        </Grid>
                    </Stack>
                )}
            </MainCard>

            <ServerDialog
                show={showServerDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowServerDialog(false)}
                onConfirm={onServerDialogConfirm}
                setError={setError}
            />
        </>
    )
}

export default ClaudeWS
