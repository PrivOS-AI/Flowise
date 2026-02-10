import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, FormControl, FormHelperText } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export const SimpleDateTimePicker = ({ value, onChange, disabled = false, type = 'datetime-local', helperText, error }) => {
    const theme = useTheme()
    const [localValue, setLocalValue] = useState('')

    // Convert ISO to datetime-local format
    const formatForInput = (isoString) => {
        if (!isoString) return ''
        try {
            const date = new Date(isoString)
            if (isNaN(date.getTime())) return ''

            // Format based on type
            if (type === 'date') {
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                return `${year}-${month}-${day}`
            } else {
                // datetime-local format
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                const hours = String(date.getHours()).padStart(2, '0')
                const minutes = String(date.getMinutes()).padStart(2, '0')
                return `${year}-${month}-${day}T${hours}:${minutes}`
            }
        } catch (error) {
            console.error('Error formatting date:', error)
            return ''
        }
    }

    // Convert datetime-local to ISO format
    const convertToISO = (inputValue) => {
        if (!inputValue) return ''
        try {
            const date = new Date(inputValue)
            if (isNaN(date.getTime())) return ''
            return date.toISOString()
        } catch (error) {
            console.error('Error converting to ISO:', error)
            return ''
        }
    }

    useEffect(() => {
        setLocalValue(formatForInput(value))
    }, [value])

    const handleChange = (event) => {
        const newValue = event.target.value
        setLocalValue(newValue)

        if (newValue) {
            const isoValue = convertToISO(newValue)
            onChange(isoValue)
        } else {
            onChange('')
        }
    }

    return (
        <FormControl fullWidth error={error}>
            <Box
                sx={{
                    position: 'relative',
                    width: '100%'
                }}
            >
                <input
                    type={type}
                    value={localValue}
                    onChange={handleChange}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: '8.5px 14px',
                        fontSize: '14px',
                        fontFamily: theme.typography.fontFamily,
                        border: `1px solid ${error ? theme.palette.error.main : theme.palette.grey[300]}`,
                        borderRadius: '4px',
                        backgroundColor: disabled ? theme.palette.action.disabledBackground : theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        outline: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'border-color 0.2s',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = theme.palette.primary.main
                        e.target.style.boxShadow = `0 0 0 2px ${theme.palette.primary.main}25`
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = error ? theme.palette.error.main : theme.palette.grey[300]
                        e.target.style.boxShadow = 'none'
                    }}
                />

                {/* Custom calendar icon overlay */}
                <Box
                    sx={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        color: theme.palette.text.secondary
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                    </svg>
                </Box>
            </Box>

            {helperText && (
                <FormHelperText sx={{ color: error ? theme.palette.error.main : theme.palette.text.secondary }}>
                    {helperText}
                </FormHelperText>
            )}
        </FormControl>
    )
}

SimpleDateTimePicker.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    type: PropTypes.oneOf(['date', 'datetime-local']),
    helperText: PropTypes.string,
    error: PropTypes.bool
}

export default SimpleDateTimePicker