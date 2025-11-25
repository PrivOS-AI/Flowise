import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { Stack, Switch, FormControlLabel, Typography, Box, Button, Alert, Paper } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconRobot } from '@tabler/icons-react'

// API
import chatflowsApi from '@/api/chatflows'

// Notifications
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { useDispatch } from 'react-redux'

const BotToggle = ({ dialogProps }) => {
    const theme = useTheme()
    const dispatch = useDispatch()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [enabled, setEnabled] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (dialogProps.chatflow?.id) {
            loadBotConfig()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps.chatflow?.id])

    const loadBotConfig = async () => {
        try {
            setLoading(true)
            // Get chatflow details which includes botEnabled
            const response = await chatflowsApi.getSpecificChatflow(dialogProps.chatflow.id)
            if (response.data) {
                setEnabled(response.data.botEnabled || false)
            }
        } catch (error) {
            console.error('Failed to load bot config:', error)
            enqueueSnackbar({
                message: 'Failed to load bot configuration',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            Dismiss
                        </Button>
                    )
                }
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            await chatflowsApi.updateBotEnabled(dialogProps.chatflow.id, enabled)
            enqueueSnackbar({
                message: `Bot ${enabled ? 'enabled' : 'disabled'} successfully`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    autoHideDuration: 3000,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            Dismiss
                        </Button>
                    )
                }
            })
        } catch (error) {
            console.error('Failed to save bot config:', error)
            enqueueSnackbar({
                message: error.response?.data?.message || 'Failed to save bot configuration',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            Dismiss
                        </Button>
                    )
                }
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>Loading...</Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={3}>
                {/* Header */}
                <Stack direction='row' alignItems='center' spacing={2}>
                    <IconRobot size={28} color={theme.palette.primary.main} />
                    <Typography variant='h4'>Bot Configuration</Typography>
                </Stack>

                {/* Enable Toggle */}
                <Paper
                    sx={{
                        p: 2,
                        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]
                    }}
                >
                    <FormControlLabel
                        control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} color='primary' size='medium' />}
                        label={
                            <Stack>
                                <Typography variant='subtitle1' fontWeight={600}>
                                    Enable as Bot
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    Mark this chatflow as a bot that can be triggered by schedule
                                </Typography>
                            </Stack>
                        }
                    />
                </Paper>

                {/* Info Alert */}
                {enabled && (
                    <Alert severity='info'>
                        <Typography variant='body2'>
                            <strong>Note:</strong> When enabled, this chatflow will appear in the list of available bots for schedule
                            triggers and other automated workflows.
                        </Typography>
                    </Alert>
                )}

                {/* Save Button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant='contained' color='primary' onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </Box>
            </Stack>
        </Box>
    )
}

BotToggle.propTypes = {
    dialogProps: PropTypes.object.isRequired
}

export default BotToggle
