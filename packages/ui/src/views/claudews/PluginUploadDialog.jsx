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
    Typography,
    Alert,
    CircularProgress,
    LinearProgress
} from '@mui/material'
import { IconUpload } from '@tabler/icons-react'

// API
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'

// ==============================|| PLUGIN UPLOAD DIALOG ||============================== //

const PluginUploadDialog = ({ show, server, onClose, onSuccess, setError }) => {
    const uploadPluginApi = useApi(claudewsApi.uploadPlugin)
    const [selectedFile, setSelectedFile] = useState(null)
    const [dragActive, setDragActive] = useState(false)
    const [step, setStep] = useState('upload') // 'upload', 'preview', 'importing'
    const [previewItems, setPreviewItems] = useState([])
    const [sessionId, setSessionId] = useState(null)

    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0])
        }
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!selectedFile || !server) return

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('dryRun', 'true') // First phase: preview

            const result = await uploadPluginApi.request(server.id, formData)
            const response = result.data || result // Handle both wrapped and unwrapped responses

            console.log('[PluginUpload] Response:', response)

            // Check if response has preview items (two-phase upload)
            if (response && response.items && response.items.length > 0) {
                // Show preview step
                setPreviewItems(response.items)
                setSessionId(response.sessionId)
                setStep('preview')
            } else {
                // Single-phase upload completed
                console.log('[PluginUpload] Single-phase upload completed')
                onSuccess()
                handleClose()
            }
        } catch (error) {
            console.error('[PluginUpload] Error:', error)
            setError(error)
        }
    }

    const handleConfirmImport = async () => {
        if (!sessionId) return

        setStep('importing')
        try {
            console.log('[PluginUpload] Confirming with sessionId:', sessionId)
            await uploadPluginApi.request(server.id, { sessionId, confirm: true })
            onSuccess()
            handleClose()
        } catch (error) {
            console.error('[PluginUpload] Confirmation error:', error)
            setError(error)
            setStep('preview') // Go back to preview on error
        }
    }

    const handleCancelImport = () => {
        console.log('[PluginUpload] User cancelled import')
        setStep('upload')
        setPreviewItems([])
        setSessionId(null)
    }

    const handleClose = () => {
        setSelectedFile(null)
        setDragActive(false)
        setStep('upload')
        setPreviewItems([])
        setSessionId(null)
        onClose()
    }

    return (
        <Dialog open={show} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>{step === 'preview' ? 'Confirm Import' : 'Upload Plugin'}</DialogTitle>
            <DialogContent>
                {step === 'upload' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity='info'>
                            Upload a zip file containing your plugin. The file should include the plugin manifest and all necessary files.
                        </Alert>

                        <Box
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            sx={{
                                border: 2,
                                borderStyle: 'dashed',
                                borderColor: dragActive ? 'primary.main' : 'grey.300',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: 'pointer',
                                bgcolor: dragActive ? 'action.hover' : 'background.paper',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => document.getElementById('plugin-file-input').click()}
                        >
                            <IconUpload size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                            <Typography variant='body1' gutterBottom>
                                {selectedFile ? selectedFile.name : 'Drop plugin file here or click to browse'}
                            </Typography>
                            <Typography variant='body2' color='textSecondary'>
                                Accepted formats: .zip, .tar.gz
                            </Typography>
                            <input
                                id='plugin-file-input'
                                type='file'
                                accept='.zip,.tar.gz'
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </Box>

                        {selectedFile && (
                            <Box>
                                <Typography variant='body2'>
                                    <strong>Selected:</strong> {selectedFile.name}
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    Size: {(selectedFile.size / 1024).toFixed(2)} KB
                                </Typography>
                            </Box>
                        )}

                        {uploadPluginApi.loading && <LinearProgress />}
                    </Box>
                )}

                {step === 'preview' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity='success'>Found {previewItems.length} component(s) to import:</Alert>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {previewItems.map((item, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        p: 2,
                                        border: 1,
                                        borderColor: 'grey.300',
                                        borderRadius: 1,
                                        bgcolor: 'background.paper'
                                    }}
                                >
                                    <Typography variant='body1'>
                                        <strong>{item.type}:</strong> {item.name}
                                    </Typography>
                                    {item.targetPath && (
                                        <Typography variant='body2' color='textSecondary'>
                                            {item.targetPath}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {step === 'importing' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, alignItems: 'center' }}>
                        <CircularProgress />
                        <Typography>Importing plugin...</Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {step === 'upload' && (
                    <>
                        <Button onClick={handleClose} disabled={uploadPluginApi.loading}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpload} variant='contained' disabled={!selectedFile || uploadPluginApi.loading}>
                            {uploadPluginApi.loading ? <CircularProgress size={20} /> : 'Upload'}
                        </Button>
                    </>
                )}
                {step === 'preview' && (
                    <>
                        <Button onClick={handleCancelImport}>Cancel</Button>
                        <Button onClick={handleConfirmImport} variant='contained'>
                            Confirm Import
                        </Button>
                    </>
                )}
                {step === 'importing' && (
                    <Button disabled>Importing...</Button>
                )}
            </DialogActions>
        </Dialog>
    )
}

PluginUploadDialog.propTypes = {
    show: PropTypes.bool,
    server: PropTypes.object,
    onClose: PropTypes.func,
    onSuccess: PropTypes.func,
    setError: PropTypes.func
}

export default PluginUploadDialog
