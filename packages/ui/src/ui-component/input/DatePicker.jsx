import React, { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { format, isValid, parse } from 'date-fns'
import {
    Button,
    Popover,
    TextField,
    Box,
    IconButton,
    Typography,
    Paper,
    Grid
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { CalendarToday, ChevronLeft, ChevronRight } from '@mui/icons-material'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const DatePicker = ({ value, onChange, disabled = false, placeholder = 'Pick a date', helperText }) => {
    const theme = useTheme()
    const [anchorEl, setAnchorEl] = useState(null)
    const [selectedDate, setSelectedDate] = useState(null)
    const [viewDate, setViewDate] = useState(new Date())
    const [inputValue, setInputValue] = useState('')
    const hiddenInputRef = useRef(null)

    // Parse initial value
    useEffect(() => {
        if (value) {
            let date = null
            if (typeof value === 'string') {
                // Try to parse ISO string or YYYY-MM-DD format
                date = new Date(value)
                if (!isValid(date)) {
                    // Try parsing DD/MM/YYYY format
                    const parts = value.split('/')
                    if (parts.length === 3) {
                        date = new Date(parts[2], parts[1] - 1, parts[0])
                    }
                }
            } else if (value instanceof Date) {
                date = value
            }

            if (date && isValid(date)) {
                setSelectedDate(date)
                setViewDate(date)
                setInputValue(format(date, 'yyyy-MM-dd'))
            }
        }
    }, [value])

    const handleButtonClick = (event) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleDateSelect = (day) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
        setSelectedDate(newDate)
        setInputValue(format(newDate, 'yyyy-MM-dd'))

        // Return ISO string for backend
        onChange(newDate.toISOString())
        handleClose()
    }

    const handleMonthChange = (direction) => {
        const newDate = new Date(viewDate)
        newDate.setMonth(viewDate.getMonth() + direction)
        setViewDate(newDate)
    }

    const handleYearChange = (direction) => {
        const newDate = new Date(viewDate)
        newDate.setFullYear(viewDate.getFullYear() + direction)
        setViewDate(newDate)
    }

    const handleInputChange = (event) => {
        const value = event.target.value
        setInputValue(value)

        // Try to parse the input
        const date = parse(value, 'yyyy-MM-dd', new Date())
        if (isValid(date)) {
            setSelectedDate(date)
            setViewDate(date)
            onChange(date.toISOString())
        }
    }

    const getDaysInMonth = () => {
        const year = viewDate.getFullYear()
        const month = viewDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        const days = []

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null)
        }

        // Add days of month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i)
        }

        return days
    }

    const formatDisplayDate = () => {
        if (selectedDate && isValid(selectedDate)) {
            return format(selectedDate, 'yyyy-MM-dd')
        }
        return ''
    }

    const isToday = (day) => {
        const today = new Date()
        return day === today.getDate() &&
               viewDate.getMonth() === today.getMonth() &&
               viewDate.getFullYear() === today.getFullYear()
    }

    const isSelected = (day) => {
        if (!selectedDate || !day) return false
        return day === selectedDate.getDate() &&
               viewDate.getMonth() === selectedDate.getMonth() &&
               viewDate.getFullYear() === selectedDate.getFullYear()
    }

    const open = Boolean(anchorEl)

    return (
        <Box sx={{ width: '100%' }}>
            {/* Main Button */}
            <Button
                variant="outlined"
                onClick={handleButtonClick}
                disabled={disabled}
                fullWidth
                startIcon={<CalendarToday fontSize="small" />}
                sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    textTransform: 'none',
                    color: selectedDate ? theme.palette.text.primary : theme.palette.text.secondary,
                    borderColor: theme.palette.grey[300],
                    backgroundColor: theme.palette.background.paper,
                    '&:hover': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: theme.palette.background.paper
                    },
                    padding: '8px 12px',
                    fontWeight: 400,
                    fontSize: '0.875rem'
                }}
            >
                {formatDisplayDate() || placeholder}
            </Button>

            {/* Hidden input for keyboard users */}
            <input
                ref={hiddenInputRef}
                type="date"
                value={inputValue}
                onChange={handleInputChange}
                disabled={disabled}
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: '1px',
                    height: '1px'
                }}
                aria-label="Date picker input"
            />

            {/* Helper text */}
            {helperText && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                    {helperText}
                </Typography>
            )}

            {/* Calendar Popover */}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        mt: 1,
                        boxShadow: theme.shadows[8],
                        borderRadius: 2
                    }
                }}
            >
                <Paper sx={{ p: 2, width: 280 }}>
                    {/* Month and Year Navigation */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <IconButton size="small" onClick={() => handleMonthChange(-1)}>
                            <ChevronLeft fontSize="small" />
                        </IconButton>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {MONTHS[viewDate.getMonth()]}
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {viewDate.getFullYear()}
                            </Typography>
                        </Box>

                        <IconButton size="small" onClick={() => handleMonthChange(1)}>
                            <ChevronRight fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Year Navigation */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                        <Button
                            size="small"
                            variant="text"
                            onClick={() => handleYearChange(-1)}
                            sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                        >
                            ← Prev Year
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            onClick={() => handleYearChange(1)}
                            sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                        >
                            Next Year →
                        </Button>
                    </Box>

                    {/* Weekday Headers */}
                    <Grid container spacing={0} sx={{ mb: 1 }}>
                        {WEEKDAYS.map((day) => (
                            <Grid item xs={12/7} key={day}>
                                <Typography
                                    align="center"
                                    variant="caption"
                                    sx={{
                                        color: theme.palette.text.secondary,
                                        fontWeight: 600,
                                        fontSize: '0.7rem'
                                    }}
                                >
                                    {day}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Calendar Days */}
                    <Grid container spacing={0}>
                        {getDaysInMonth().map((day, index) => (
                            <Grid item xs={12/7} key={index}>
                                {day ? (
                                    <Box
                                        onClick={() => handleDateSelect(day)}
                                        sx={{
                                            width: '100%',
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            borderRadius: 1,
                                            fontSize: '0.875rem',
                                            backgroundColor: isSelected(day)
                                                ? theme.palette.primary.main
                                                : isToday(day)
                                                ? theme.palette.action.hover
                                                : 'transparent',
                                            color: isSelected(day)
                                                ? theme.palette.primary.contrastText
                                                : theme.palette.text.primary,
                                            '&:hover': {
                                                backgroundColor: isSelected(day)
                                                    ? theme.palette.primary.dark
                                                    : theme.palette.action.hover
                                            },
                                            fontWeight: isToday(day) ? 600 : 400
                                        }}
                                    >
                                        {day}
                                    </Box>
                                ) : (
                                    <Box sx={{ width: '100%', aspectRatio: '1' }} />
                                )}
                            </Grid>
                        ))}
                    </Grid>

                    {/* Today Button */}
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                                const today = new Date()
                                setSelectedDate(today)
                                setViewDate(today)
                                setInputValue(format(today, 'yyyy-MM-dd'))
                                onChange(today.toISOString())
                                handleClose()
                            }}
                            sx={{ textTransform: 'none' }}
                        >
                            Today
                        </Button>
                    </Box>
                </Paper>
            </Popover>
        </Box>
    )
}

DatePicker.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    placeholder: PropTypes.string,
    helperText: PropTypes.string
}

export default DatePicker