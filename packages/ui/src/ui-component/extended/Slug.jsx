import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'

// material-ui
import { Button, OutlinedInput, Box, InputAdornment } from '@mui/material'
import { IconX, IconLink } from '@tabler/icons-react'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'

// store
import useNotifier from '@/utils/useNotifier'

// API
import chatflowsApi from '@/api/chatflows'

const Slug = ({ dialogProps }) => {
    const dispatch = useDispatch()

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [slug, setSlug] = useState('')
    const [error, setError] = useState('')

    const handleChange = (evnt) => {
        const value = evnt.target.value
        // Only allow alphanumeric and hyphen
        const sanitizedValue = value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
        setSlug(sanitizedValue)
        setError('')
    }

    const onSave = async () => {
        try {
            const saveResp = await chatflowsApi.updateChatflow(dialogProps.chatflow.id, {
                slug: slug
            })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: 'Slug Saved',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        persist: false,
                        autoHideDuration: 3000,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                dispatch({ type: SET_CHATFLOW, chatflow: saveResp.data })
            }
        } catch (error) {
            setError(error?.response?.data?.message || '')

            if (error?.status === 500) {
                enqueueSnackbar({
                    message: `Failed to save slug. Please try again later.`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: false,
                        autoHideDuration: 3000,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
    }

    useEffect(() => {
        if (dialogProps.chatflow) {
            setSlug(dialogProps.chatflow.slug || '')
        }

        return () => {}
    }, [dialogProps])

    return (
        <>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 10,
                    background: '#e3f2fd',
                    padding: 10
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    <IconLink size={30} color='#1565c0' />
                    <div style={{ marginLeft: 10 }}>
                        <div style={{ color: '#1565c0', fontWeight: 500 }}>
                            Slug is a unique identifier for your chatflow URL (e.g., /chatflow/your-slug)
                        </div>
                        <div style={{ color: '#1976d2', fontSize: '0.85rem', marginTop: 4 }}>
                            Use this as a webhook URL to trigger your flow
                        </div>
                    </div>
                </div>
            </div>
            <Box sx={{ p: 2 }}>
                <OutlinedInput
                    sx={{ width: '100%' }}
                    type='text'
                    onChange={handleChange}
                    size='small'
                    value={slug}
                    placeholder='Enter slug (alphanumeric and hyphens only)'
                    error={!!error}
                    endAdornment={
                        error && (
                            <InputAdornment position='end'>
                                <span style={{ color: '#f44336', fontSize: '0.75rem' }}>{error}</span>
                            </InputAdornment>
                        )
                    }
                />
                <Box sx={{ mt: 2 }}>
                    <StyledButton variant='contained' onClick={onSave} disabled={!slug || !!error}>
                        Save
                    </StyledButton>
                </Box>
            </Box>
        </>
    )
}

Slug.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default Slug
