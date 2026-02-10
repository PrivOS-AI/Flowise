import React, { useState, useEffect, forwardRef } from 'react'
import PropTypes from 'prop-types'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { TextField, FormControl } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// Custom input component for DatePicker
const DatePickerCustomInput = forwardRef(function DatePickerCustomInput({ value, onClick, placeholder, disabled }, ref) {
    const theme = useTheme()

    return (
        <TextField
            ref={ref}
            value={value || ''}
            onClick={onClick}
            placeholder={placeholder}
            size="small"
            fullWidth
            disabled={disabled}
            InputProps={{
                readOnly: true,
            }}
            sx={{
                '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                        borderColor: theme.palette.grey[900] + 25
                    },
                    '&:hover fieldset': {
                        borderColor: theme.palette.primary.main
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: theme.palette.primary.main
                    }
                },
                '& .MuiInputBase-input': {
                    cursor: 'pointer',
                    padding: '8.5px 14px'
                }
            }}
        />
    )
})

DatePickerCustomInput.propTypes = {
    value: PropTypes.string,
    onClick: PropTypes.func,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool
}

export const DateTimePicker = ({ inputParam, value, onChange, disabled = false }) => {
    const theme = useTheme()
    const [selectedDate, setSelectedDate] = useState(null)

    // Parse initial value
    useEffect(() => {
        if (value) {
            try {
                const date = new Date(value)
                if (!isNaN(date.getTime())) {
                    setSelectedDate(date)
                }
            } catch (error) {
                console.error('Error parsing date value:', error)
                setSelectedDate(null)
            }
        } else {
            setSelectedDate(null)
        }
    }, [value])

    const handleDateChange = (date) => {
        setSelectedDate(date)
        if (date) {
            // Convert to ISO string for backend
            onChange(date.toISOString())
        } else {
            onChange('')
        }
    }

    const getDateFormat = () => {
        switch (inputParam.type) {
            case 'date':
                return 'yyyy-MM-dd'
            case 'time':
                return 'HH:mm'
            case 'datetime':
            case 'datetime-local':
            default:
                return 'yyyy-MM-dd HH:mm'
        }
    }

    const shouldShowTimeSelect = () => {
        return inputParam.type === 'datetime-local' || inputParam.type === 'datetime' || inputParam.type === 'time'
    }

    return (
        <FormControl sx={{ mt: 1, width: '100%' }} size='small'>
            <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                showTimeSelect={shouldShowTimeSelect()}
                showTimeSelectOnly={inputParam.type === 'time'}
                timeIntervals={15}
                timeCaption="Time"
                dateFormat={getDateFormat()}
                placeholderText={inputParam.placeholder || 'Click to select date'}
                disabled={disabled}
                customInput={
                    <DatePickerCustomInput
                        placeholder={inputParam.placeholder || 'Click to select date'}
                        disabled={disabled}
                    />
                }
                showPopperArrow={false}
            />
            {inputParam.description && (
                <div style={{ fontSize: '0.75rem', color: theme.palette.text.secondary, marginTop: '4px' }}>
                    {inputParam.description}
                </div>
            )}
        </FormControl>
    )
}

DateTimePicker.propTypes = {
    inputParam: PropTypes.object.isRequired,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
}

export default DateTimePicker