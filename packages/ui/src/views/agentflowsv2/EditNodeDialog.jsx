import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useState, useEffect, useRef, useContext, memo } from 'react'
import { useUpdateNodeInternals } from 'reactflow'
import PropTypes from 'prop-types'
import {
    Stack,
    Box,
    Typography,
    TextField,
    Dialog,
    DialogContent,
    ButtonBase,
    Avatar,
    IconButton,
    Switch,
    FormControlLabel,
    InputAdornment,
    Tooltip,
    Button
} from '@mui/material'
import NodeInputHandler from '@/views/canvas/NodeInputHandler'
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@/store/actions'
import { IconPencil, IconX, IconCheck, IconInfoCircle, IconChevronUp, IconChevronDown, IconCopy } from '@tabler/icons-react'
import { useTheme } from '@mui/material/styles'
import { flowContext } from '@/store/context/ReactFlowContext'
import { showHideInputParams } from '@/utils/genericHelper'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import { v4 as uuid } from 'uuid'

const EditNodeDialog = ({ show, dialogProps, onCancel }) => {
    const portalElement = document.getElementById('portal')
    const dispatch = useDispatch()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const nodeNameRef = useRef()
    const executionLabelRef = useRef()
    const { reactFlowInstance } = useContext(flowContext)
    const updateNodeInternals = useUpdateNodeInternals()

    const [inputParams, setInputParams] = useState([])
    const [data, setData] = useState({})
    const [isEditingNodeName, setEditingNodeName] = useState(null)
    const [nodeName, setNodeName] = useState('')

    const [isEditingExecutionLabel, setEditingExecutionLabel] = useState(false)
    const [executionLabel, setExecutionLabel] = useState('')
    const [isExecutionLabelExpanded, setIsExecutionLabelExpanded] = useState(true)

    // Webhook URL state
    const [useCustomSlug, setUseCustomSlug] = useState(false)
    const [customSlug, setCustomSlug] = useState('')
    const [isWebhookUrlExpanded, setIsWebhookUrlExpanded] = useState(false)
    const [displayWebhookId, setDisplayWebhookId] = useState('')

    const onNodeLabelChange = () => {
        reactFlowInstance.setNodes((nds) =>
            nds.map((node) => {
                if (node.id === data.id) {
                    node.data = {
                        ...node.data,
                        label: nodeNameRef.current.value
                    }
                    setData(node.data)
                }
                return node
            })
        )
        updateNodeInternals(data.id)
    }

    const onCustomDataChange = ({ nodeId, inputParam, newValue }) => {
        reactFlowInstance.setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const updatedInputs = {
                        ...node.data.inputs,
                        [inputParam.name]: newValue
                    }

                    const updatedInputParams = showHideInputParams({
                        ...node.data,
                        inputs: updatedInputs
                    })

                    // Remove inputs with display set to false
                    Object.keys(updatedInputs).forEach((key) => {
                        const input = updatedInputParams.find((param) => param.name === key)
                        if (input && input.display === false) {
                            delete updatedInputs[key]
                        }
                    })

                    node.data = {
                        ...node.data,
                        inputParams: updatedInputParams,
                        inputs: updatedInputs
                    }

                    setInputParams(updatedInputParams)
                    setData(node.data)
                }
                return node
            })
        )
    }

    const onExecutionLabelChange = () => {
        reactFlowInstance.setNodes((nds) =>
            nds.map((node) => {
                if (node.id === data.id) {
                    node.data = {
                        ...node.data,
                        executionLabel: executionLabelRef.current.value
                    }
                    setData(node.data)
                }
                return node
            })
        )
        updateNodeInternals(data.id)
    }

    useEffect(() => {
        let initialExecutionLabel = ''

        if (dialogProps.inputParams) {
            setInputParams(dialogProps.inputParams)
        }
        if (dialogProps.data) {
            setData(dialogProps.data)
            if (dialogProps.data.label) setNodeName(dialogProps.data.label)
            if (dialogProps.data.executionLabel) {
                setExecutionLabel(dialogProps.data.executionLabel)
                initialExecutionLabel = dialogProps.data.executionLabel
            }
            // Sync webhook URL state with data.trigger
            const newWebhookId = uuid()
            if (dialogProps.data.trigger) {
                setUseCustomSlug(dialogProps.data.trigger.useCustomSlug ?? false)
                setCustomSlug(dialogProps.data.trigger.slug ?? '')
                setDisplayWebhookId(dialogProps.data?.trigger?.webhookId)
                // Initialize webhookId if not exists
                if (!dialogProps.data.trigger.webhookId && reactFlowInstance) {
                    reactFlowInstance.setNodes((nds) =>
                        nds.map((node) => {
                            if (node.id === dialogProps.data.id) {
                                node.data = {
                                    ...node.data,
                                    trigger: {
                                        ...node.data.trigger,
                                        webhookId: newWebhookId
                                    }
                                }
                                setData(node.data)
                                setDisplayWebhookId(newWebhookId)
                            }
                            return node
                        })
                    )
                }
            } else if (reactFlowInstance) {
                // Initialize trigger with webhookId if trigger doesn't exist
                reactFlowInstance.setNodes((nds) =>
                    nds.map((node) => {
                        if (node.id === dialogProps.data.id) {
                            node.data = {
                                ...node.data,
                                trigger: {
                                    webhookId: newWebhookId,
                                    slug: '',
                                    useCustomSlug: false
                                }
                            }
                            setData(node.data)
                            setDisplayWebhookId(newWebhookId)
                        }
                        return node
                    })
                )
            }
        }

        return () => {
            setInputParams([])
            setData({})
            setEditingExecutionLabel(false)
            setIsExecutionLabelExpanded(true)
            setExecutionLabel(initialExecutionLabel)
            setUseCustomSlug(false)
            setCustomSlug('')
            setIsWebhookUrlExpanded(false)
            setDisplayWebhookId('')
        }
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const component = show ? (
        <Dialog
            onClose={onCancel}
            open={show}
            fullWidth
            maxWidth='sm'
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogContent>
                {data && data.name && (
                    <Box sx={{ width: '100%' }}>
                        {!isEditingNodeName ? (
                            <Stack flexDirection='row' sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Typography
                                    sx={{
                                        ml: 2,
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap'
                                    }}
                                    variant='h4'
                                >
                                    {nodeName}
                                </Typography>

                                {data?.id && (
                                    <ButtonBase title='Edit Name' sx={{ borderRadius: '50%' }}>
                                        <Avatar
                                            variant='rounded'
                                            sx={{
                                                ...theme.typography.commonAvatar,
                                                ...theme.typography.mediumAvatar,
                                                transition: 'all .2s ease-in-out',
                                                ml: 1,
                                                background: theme.palette.secondary.light,
                                                color: theme.palette.secondary.dark,
                                                '&:hover': {
                                                    background: theme.palette.secondary.dark,
                                                    color: theme.palette.secondary.light
                                                }
                                            }}
                                            color='inherit'
                                            onClick={() => setEditingNodeName(true)}
                                        >
                                            <IconPencil stroke={1.5} size='1rem' />
                                        </Avatar>
                                    </ButtonBase>
                                )}
                            </Stack>
                        ) : (
                            <Stack flexDirection='row' sx={{ width: '100%' }}>
                                <TextField
                                    //eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                    size='small'
                                    sx={{
                                        width: '100%',
                                        ml: 2
                                    }}
                                    inputRef={nodeNameRef}
                                    defaultValue={nodeName}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            data.label = nodeNameRef.current.value
                                            setNodeName(nodeNameRef.current.value)
                                            onNodeLabelChange()
                                            setEditingNodeName(false)
                                        } else if (e.key === 'Escape') {
                                            setEditingNodeName(false)
                                        }
                                    }}
                                />
                                <ButtonBase title='Save Name' sx={{ borderRadius: '50%' }}>
                                    <Avatar
                                        variant='rounded'
                                        sx={{
                                            ...theme.typography.commonAvatar,
                                            ...theme.typography.mediumAvatar,
                                            transition: 'all .2s ease-in-out',
                                            background: theme.palette.success.light,
                                            color: theme.palette.success.dark,
                                            ml: 1,
                                            '&:hover': {
                                                background: theme.palette.success.dark,
                                                color: theme.palette.success.light
                                            }
                                        }}
                                        color='inherit'
                                        onClick={() => {
                                            data.label = nodeNameRef.current.value
                                            setNodeName(nodeNameRef.current.value)
                                            onNodeLabelChange()
                                            setEditingNodeName(false)
                                        }}
                                    >
                                        <IconCheck stroke={1.5} size='1rem' />
                                    </Avatar>
                                </ButtonBase>
                                <ButtonBase title='Cancel' sx={{ borderRadius: '50%' }}>
                                    <Avatar
                                        variant='rounded'
                                        sx={{
                                            ...theme.typography.commonAvatar,
                                            ...theme.typography.mediumAvatar,
                                            transition: 'all .2s ease-in-out',
                                            background: theme.palette.error.light,
                                            color: theme.palette.error.dark,
                                            ml: 1,
                                            '&:hover': {
                                                background: theme.palette.error.dark,
                                                color: theme.palette.error.light
                                            }
                                        }}
                                        color='inherit'
                                        onClick={() => setEditingNodeName(false)}
                                    >
                                        <IconX stroke={1.5} size='1rem' />
                                    </Avatar>
                                </ButtonBase>
                            </Stack>
                        )}
                    </Box>
                )}
                {/* Execution Label Section */}
                <Box sx={{ width: '100%', mb: 2 }}>
                    {/* Header with title and collapse arrow */}
                    <Stack flexDirection='row' sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Stack flexDirection='row' sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography sx={{ ml: 2, fontSize: '0.9rem' }}>Execution Label</Typography>
                            <ButtonBase title='Edit Name' sx={{ borderRadius: '50%' }}>
                                <Avatar
                                    variant='rounded'
                                    sx={{
                                        ...theme.typography.commonAvatar,
                                        ...theme.typography.mediumAvatar,
                                        transition: 'all .2s ease-in-out',
                                        ml: 1,
                                        background: theme.palette.secondary.light,
                                        color: theme.palette.secondary.dark,
                                        '&:hover': {
                                            background: theme.palette.secondary.dark,
                                            color: theme.palette.secondary.light
                                        }
                                    }}
                                    color='inherit'
                                    onClick={() => {
                                        setEditingExecutionLabel(true)
                                        setIsExecutionLabelExpanded(false)
                                    }}
                                >
                                    <IconPencil stroke={1.5} size='1rem' />
                                </Avatar>
                            </ButtonBase>
                        </Stack>

                        <IconButton
                            size='small'
                            onClick={() => setIsExecutionLabelExpanded(!isExecutionLabelExpanded)}
                            sx={{
                                padding: 0,
                                mr: 1,
                                '&:hover': {
                                    backgroundColor: 'transparent'
                                }
                            }}
                        >
                            {isExecutionLabelExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </IconButton>
                    </Stack>

                    {/* Collapsible content */}
                    {!isExecutionLabelExpanded && (
                        <Box
                            sx={{
                                ml: 2,
                                mr: 2,
                                p: 1.5,
                                backgroundColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                borderRadius: '8px',
                                border: `1px solid ${customization.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`
                            }}
                        >
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                placeholder='Enter execution label...'
                                size='small'
                                inputRef={executionLabelRef}
                                defaultValue={executionLabel}
                                disabled={!isEditingExecutionLabel}
                                sx={{
                                    mb: 1,
                                    '& .MuiInputBase-input': {
                                        fontSize: '0.85rem'
                                    },
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'white'
                                    }
                                }}
                            />
                            {isEditingExecutionLabel && (
                                <Stack flexDirection='row' sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                    <ButtonBase title='Save' sx={{ borderRadius: '50%' }}>
                                        <Avatar
                                            variant='rounded'
                                            sx={{
                                                ...theme.typography.commonAvatar,
                                                ...theme.typography.mediumAvatar,
                                                transition: 'all .2s ease-in-out',
                                                background: theme.palette.success.light,
                                                color: theme.palette.success.dark,
                                                '&:hover': {
                                                    background: theme.palette.success.dark,
                                                    color: theme.palette.success.light
                                                }
                                            }}
                                            color='inherit'
                                            onClick={() => {
                                                setExecutionLabel(executionLabelRef.current.value)
                                                onExecutionLabelChange()
                                                setEditingExecutionLabel(false)
                                            }}
                                        >
                                            <IconCheck stroke={1.5} size='1rem' />
                                        </Avatar>
                                    </ButtonBase>
                                    <ButtonBase title='Cancel' sx={{ borderRadius: '50%' }}>
                                        <Avatar
                                            variant='rounded'
                                            sx={{
                                                ...theme.typography.commonAvatar,
                                                ...theme.typography.mediumAvatar,
                                                transition: 'all .2s ease-in-out',
                                                background: theme.palette.error.light,
                                                color: theme.palette.error.dark,
                                                '&:hover': {
                                                    background: theme.palette.error.dark,
                                                    color: theme.palette.error.light
                                                }
                                            }}
                                            color='inherit'
                                            onClick={() => {
                                                setEditingExecutionLabel(false)
                                            }}
                                        >
                                            <IconX stroke={1.5} size='1rem' />
                                        </Avatar>
                                    </ButtonBase>
                                </Stack>
                            )}
                        </Box>
                    )}
                </Box>
                {data?.hint && (
                    <Stack
                        direction='row'
                        alignItems='center'
                        sx={{
                            ml: 2,
                            backgroundColor: customization.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            borderRadius: '8px',
                            mr: 2,
                            px: 1.5,
                            py: 1,
                            mt: 1,
                            mb: 1,
                            border: `1px solid ${customization.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`
                        }}
                    >
                        <IconInfoCircle size='1rem' stroke={1.5} color={theme.palette.info.main} style={{ marginRight: '6px' }} />
                        <Typography
                            variant='caption'
                            color='text.secondary'
                            sx={{
                                fontStyle: 'italic',
                                lineHeight: 1.2
                            }}
                        >
                            {data.hint}
                        </Typography>
                    </Stack>
                )}
                {/* Webhook URL Section - always show for relevant nodes */}
                {data?.name === 'privosTrigger' && (
                    <Box sx={{ width: '100%', mb: 2 }}>
                        {/* Header with title and collapse arrow */}
                        <Stack
                            flexDirection='row'
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                        >
                            <Typography sx={{ ml: 2, fontSize: '0.9rem' }}>Webhook URLs</Typography>
                            <Stack flexDirection='row' sx={{ display: 'flex', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={useCustomSlug}
                                            onChange={(e) => {
                                                const newValue = e.target.checked
                                                setUseCustomSlug(newValue)
                                                // Update data.trigger
                                                reactFlowInstance.setNodes((nds) =>
                                                    nds.map((node) => {
                                                        if (node.id === data.id) {
                                                            const updatedTrigger = node.data.trigger || { webhookId: node.id, slug: '' }
                                                            node.data = {
                                                                ...node.data,
                                                                trigger: {
                                                                    ...updatedTrigger,
                                                                    useCustomSlug: newValue
                                                                }
                                                            }
                                                            setData(node.data)
                                                        }
                                                        return node
                                                    })
                                                )
                                            }}
                                            size='small'
                                        />
                                    }
                                    label='Use Slug'
                                    sx={{ ml: 0, '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}
                                />
                                <IconButton
                                    size='small'
                                    onClick={() => setIsWebhookUrlExpanded(!isWebhookUrlExpanded)}
                                    sx={{
                                        padding: 0,
                                        mr: 1,
                                        '&:hover': {
                                            backgroundColor: 'transparent'
                                        }
                                    }}
                                >
                                    {isWebhookUrlExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                                </IconButton>
                            </Stack>
                        </Stack>

                        {/* Collapsible content */}
                        {!isWebhookUrlExpanded && (
                            <Box sx={{ ml: 2, mr: 2 }}>
                                {/* Webhook URL display (when useCustomSlug is false) */}
                                {!useCustomSlug && (
                                    <Stack direction='row' sx={{ alignItems: 'center', gap: 0.5 }}>
                                        <Typography
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                                                color: customization.isDarkMode ? '#fff' : '#000',
                                                px: 1,
                                                py: 0.5,
                                                borderRadius: '4px',
                                                minWidth: '45px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            POST
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={2}
                                            size='small'
                                            value={`${window.location.origin}/api/v1/webhook/${displayWebhookId}`}
                                            disabled
                                            sx={{
                                                '& .MuiInputBase-input': {
                                                    fontSize: '0.85rem',
                                                    fontFamily: 'monospace',
                                                    color: customization.isDarkMode ? '#fff' : '#000',
                                                    wordBreak: 'break-all'
                                                },
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.04)'
                                                }
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position='end'>
                                                        <Tooltip title='Click to copy webhook URL'>
                                                            <IconButton
                                                                size='small'
                                                                onClick={() => {
                                                                    const url = `${window.location.origin}/api/v1/webhook/${displayWebhookId}`
                                                                    navigator.clipboard.writeText(url)
                                                                    dispatch(
                                                                        enqueueSnackbarAction({
                                                                            message: 'URL copied!',
                                                                            options: {
                                                                                key: new Date().getTime() + Math.random(),
                                                                                variant: 'success',
                                                                                autoHideDuration: 2000,
                                                                                action: (key) => (
                                                                                    <Button
                                                                                        style={{ color: 'white' }}
                                                                                        onClick={() => dispatch(closeSnackbarAction(key))}
                                                                                    >
                                                                                        <IconX size={16} />
                                                                                    </Button>
                                                                                )
                                                                            }
                                                                        })
                                                                    )
                                                                }}
                                                            >
                                                                <IconCopy size={18} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Stack>
                                )}

                                {/* Custom Slug Input (when useCustomSlug is true) */}
                                {useCustomSlug && (
                                    <Stack direction='row' sx={{ alignItems: 'center', gap: 0.5 }}>
                                        <Typography
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                                                color: customization.isDarkMode ? '#fff' : '#000',
                                                px: 1,
                                                py: 0.5,
                                                borderRadius: '4px',
                                                minWidth: '45px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            POST
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            size='small'
                                            placeholder='my-custom-trigger'
                                            value={customSlug}
                                            onChange={(e) => {
                                                let newValue = e.target.value
                                                // Auto lowercase and filter: only alphanumeric and hyphens
                                                newValue = newValue.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
                                                setCustomSlug(newValue)
                                                // Update data.trigger
                                                reactFlowInstance.setNodes((nds) =>
                                                    nds.map((node) => {
                                                        if (node.id === data.id) {
                                                            const updatedTrigger = node.data.trigger || { webhookId: node.id }
                                                            node.data = {
                                                                ...node.data,
                                                                trigger: {
                                                                    ...updatedTrigger,
                                                                    slug: newValue
                                                                }
                                                            }
                                                            setData(node.data)
                                                        }
                                                        return node
                                                    })
                                                )
                                            }}
                                            sx={{
                                                '& .MuiInputBase-input': {
                                                    fontSize: '0.85rem'
                                                },
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: customization.isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'white'
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position='start'>
                                                        <Typography
                                                            variant='caption'
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                fontSize: '0.75rem',
                                                                color: 'text.secondary'
                                                            }}
                                                        >
                                                            {`${window.location.origin}/api/v1/webhook/`}
                                                        </Typography>
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
                {inputParams
                    .filter((inputParam) => inputParam.display !== false)
                    .map((inputParam, index) => (
                        <NodeInputHandler
                            disabled={dialogProps.disabled}
                            key={index}
                            inputParam={inputParam}
                            data={data}
                            isAdditionalParams={true}
                            onCustomDataChange={onCustomDataChange}
                        />
                    ))}
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

EditNodeDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func
}

export default memo(EditNodeDialog)
