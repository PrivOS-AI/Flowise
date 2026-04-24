import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    FormControlLabel,
    Switch,
    Box,
    Alert,
    CircularProgress
} from '@mui/material'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'

// ==============================|| SERVER DIALOG ||============================== //

const ServerDialog = ({ show, dialogProps, onCancel, onConfirm, setError }) => {
    const { title, type, cancelButtonName, confirmButtonName, data } = dialogProps

    const createServerApi = useApi(claudewsApi.createServer)
    const updateServerApi = useApi(claudewsApi.updateServer)
    const testConnectionApi = useApi(claudewsApi.testConnection)
    const testConnectionWithCredentialsApi = useApi(claudewsApi.testConnectionWithCredentials)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        endpointUrl: '',
        apiKey: '',
        isActive: true
    })

    const [errors, setErrors] = useState({})
    const [testStatus, setTestStatus] = useState(null)

    useEffect(() => {
        if (show && type === 'EDIT' && data) {
            setFormData({
                name: data.name || '',
                description: data.description || '',
                endpointUrl: data.endpointUrl || '',
                // Leave blank in EDIT: server returns the encrypted blob which
                // must not be echoed back. Empty means "keep stored key".
                apiKey: '',
                isActive: data.isActive !== undefined ? data.isActive : true
            })
        } else if (show && type === 'ADD') {
            setFormData({
                name: '',
                description: '',
                endpointUrl: '',
                apiKey: '',
                isActive: true
            })
        }
        setErrors({})
        setTestStatus(null)
    }, [show, type, data])

    const handleChange = (field) => (event) => {
        const value = field === 'isActive' ? event.target.checked : event.target.value
        setFormData((prev) => ({ ...prev, [field]: value }))
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: null }))
        }
    }

    const validate = () => {
        const newErrors = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required'
        }

        if (!formData.endpointUrl.trim()) {
            newErrors.endpointUrl = 'Endpoint URL is required'
        } else {
            try {
                new URL(formData.endpointUrl)
            } catch {
                newErrors.endpointUrl = 'Invalid URL format'
            }
        }

        // In EDIT mode, blank apiKey means "keep the stored key".
        if (type !== 'EDIT' && !formData.apiKey.trim()) {
            newErrors.apiKey = 'API Key is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleTestConnection = async () => {
        if (!validate()) {
            return
        }

        setTestStatus('testing')
        try {
            // Always test with the current form values so edits take effect
            // without requiring a Save first. In EDIT mode with a blank apiKey,
            // pass the server id so the backend uses the stored key.
            const credentials = {
                endpointUrl: formData.endpointUrl,
                apiKey: formData.apiKey
            }
            if (type === 'EDIT' && data?.id) {
                credentials.id = data.id
            }
            console.log('[ClaudeWS] Testing connection with credentials:', {
                endpointUrl: credentials.endpointUrl,
                apiKeyLength: credentials.apiKey?.length || 0,
                usingStoredKey: !credentials.apiKey && !!credentials.id
            })
            const result = await testConnectionWithCredentialsApi.request(credentials)

            console.log('[ClaudeWS] Test connection result:', result)

            // Check if the result indicates success
            if (result?.data?.success === true) {
                setTestStatus('success')
            } else {
                setTestStatus('error')
            }
        } catch (error) {
            setTestStatus('error')
            console.error('[ClaudeWS] Test connection error:', error)
        }
    }

    const handleSubmit = async () => {
        if (!validate()) {
            return
        }

        try {
            if (type === 'EDIT' && data?.id) {
                // Omit apiKey when blank so the server keeps the stored key
                // instead of re-encrypting an empty value.
                const { apiKey, ...rest } = formData
                const payload = apiKey.trim() ? { ...rest, apiKey: apiKey.trim() } : rest
                await updateServerApi.request(data.id, payload)
            } else {
                await createServerApi.request(formData)
            }
            onConfirm()
        } catch (error) {
            setError(error)
        }
    }

    const isLoading = createServerApi.loading || updateServerApi.loading

    return (
        <Dialog open={show} onClose={onCancel} maxWidth='sm' fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                        label='Name'
                        value={formData.name}
                        onChange={handleChange('name')}
                        error={!!errors.name}
                        helperText={errors.name}
                        required
                        fullWidth
                    />

                    <TextField
                        label='Description'
                        value={formData.description}
                        onChange={handleChange('description')}
                        multiline
                        rows={2}
                        fullWidth
                    />

                    <TextField
                        label='Endpoint URL'
                        value={formData.endpointUrl}
                        onChange={handleChange('endpointUrl')}
                        error={!!errors.endpointUrl}
                        helperText={errors.endpointUrl || 'Example: http://localhost:3000'}
                        required
                        fullWidth
                    />

                    <TextField
                        label='API Key'
                        value={formData.apiKey}
                        onChange={handleChange('apiKey')}
                        error={!!errors.apiKey}
                        helperText={
                            errors.apiKey ||
                            (type === 'EDIT' ? 'Leave blank to keep the current key' : '')
                        }
                        placeholder={type === 'EDIT' ? '••••••••  (unchanged)' : ''}
                        type='password'
                        required={type !== 'EDIT'}
                        fullWidth
                    />

                    <FormControlLabel
                        control={<Switch checked={formData.isActive} onChange={handleChange('isActive')} />}
                        label='Active'
                    />

                    <Box display='flex' alignItems='center' gap={2}>
                        <Button
                            variant='outlined'
                            onClick={handleTestConnection}
                            disabled={testConnectionApi.loading}
                            sx={{ borderRadius: 2 }}
                        >
                            {testConnectionApi.loading ? <CircularProgress size={20} /> : 'Test Connection'}
                        </Button>
                        {testStatus === 'success' && <Alert severity='success'>Connection successful!</Alert>}
                        {testStatus === 'error' && <Alert severity='error'>Connection failed</Alert>}
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={isLoading}>
                    {cancelButtonName}
                </Button>
                <Button onClick={handleSubmit} variant='contained' disabled={isLoading}>
                    {isLoading ? <CircularProgress size={20} /> : confirmButtonName}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

ServerDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    setError: PropTypes.func
}

export default ServerDialog
