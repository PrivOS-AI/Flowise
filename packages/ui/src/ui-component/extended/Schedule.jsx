import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import {
    Stack,
    TextField,
    Switch,
    FormControlLabel,
    Typography,
    Box,
    Button,
    Alert,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    ToggleButtonGroup,
    ToggleButton,
    Paper
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconClock, IconBell } from '@tabler/icons-react'
import cronstrue from 'cronstrue'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'

// API
import chatflowsApi from '@/api/chatflows'

// Notifications
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { useDispatch } from 'react-redux'

const TIMEZONES = [
    { label: 'UTC', value: 'UTC' },
    { label: 'Asia/Ho_Chi_Minh (GMT+7)', value: 'Asia/Ho_Chi_Minh' },
    { label: 'Asia/Bangkok (GMT+7)', value: 'Asia/Bangkok' },
    { label: 'Asia/Singapore (GMT+8)', value: 'Asia/Singapore' },
    { label: 'Asia/Tokyo (GMT+9)', value: 'Asia/Tokyo' },
    { label: 'America/New_York (EST)', value: 'America/New_York' },
    { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
    { label: 'Europe/London (GMT)', value: 'Europe/London' },
    { label: 'Europe/Paris (CET)', value: 'Europe/Paris' }
]

const WEEKDAYS = [
    { label: 'Monday', value: '1' },
    { label: 'Tuesday', value: '2' },
    { label: 'Wednesday', value: '3' },
    { label: 'Thursday', value: '4' },
    { label: 'Friday', value: '5' },
    { label: 'Saturday', value: '6' },
    { label: 'Sunday', value: '0' }
]

const Schedule = ({ dialogProps }) => {
    const theme = useTheme()
    const dispatch = useDispatch()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [enabled, setEnabled] = useState(false)
    const [frequency, setFrequency] = useState('daily') // hourly, daily, weekly, monthly, custom
    const [hour, setHour] = useState('08')
    const [minute, setMinute] = useState('00')
    const [weekday, setWeekday] = useState('1') // Monday
    const [dayOfMonth, setDayOfMonth] = useState('1')
    const [customInterval, setCustomInterval] = useState('5') // For custom frequency
    const [customUnit, setCustomUnit] = useState('minutes') // minutes, hours, days
    const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [cronDescription, setCronDescription] = useState('')

    useEffect(() => {
        if (dialogProps.chatflow?.id) {
            loadScheduleConfig()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps.chatflow?.id])

    useEffect(() => {
        // Update cron description whenever pattern changes
        const cron = generateCronExpression()
        try {
            const description = cronstrue.toString(cron, { verbose: true })
            setCronDescription(description)
        } catch (error) {
            setCronDescription('Invalid cron expression')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frequency, hour, minute, weekday, dayOfMonth, customInterval, customUnit])

    const loadScheduleConfig = async () => {
        try {
            setLoading(true)
            const response = await chatflowsApi.getScheduleConfig(dialogProps.chatflow.id)

            if (response.data?.scheduleConfig) {
                const config = response.data.scheduleConfig
                setEnabled(response.data.scheduleEnabled || false)
                setTimezone(config.timezone || 'Asia/Ho_Chi_Minh')

                // Parse cron expression to determine frequency and time
                const cron = config.cronExpression || '0 8 * * *'
                parseCronExpression(cron)
            }
        } catch (error) {
            console.error('Error loading schedule config:', error)
        } finally {
            setLoading(false)
        }
    }

    const parseCronExpression = (cron) => {
        const parts = cron.split(' ')
        if (parts.length !== 5) {
            setFrequency('custom')
            return
        }

        const [min, hr, day, month, weekDay] = parts

        // Detect frequency pattern
        if (min.includes('*/') && hr === '*' && day === '*' && month === '*' && weekDay === '*') {
            // Every X minutes: */X * * * *
            const interval = min.replace('*/', '')
            if (interval && !isNaN(parseInt(interval))) {
                setFrequency('custom')
                setCustomInterval(interval)
                setCustomUnit('minutes')
                return
            }
            setFrequency('hourly')
            setMinute(min.replace('*/', ''))
        } else if (min === '0' && hr.includes('*/') && day === '*' && month === '*' && weekDay === '*') {
            // Every X hours: 0 */X * * *
            const interval = hr.replace('*/', '')
            setFrequency('custom')
            setCustomInterval(interval)
            setCustomUnit('hours')
        } else if (min === '0' && hr === '0' && day.includes('*/') && month === '*' && weekDay === '*') {
            // Every X days: 0 0 */X * *
            const interval = day.replace('*/', '')
            setFrequency('custom')
            setCustomInterval(interval)
            setCustomUnit('days')
        } else if (day === '*' && month === '*' && weekDay === '*') {
            setFrequency('daily')
            setHour(hr.padStart(2, '0'))
            setMinute(min.padStart(2, '0'))
        } else if (day === '*' && month === '*' && weekDay !== '*') {
            setFrequency('weekly')
            setHour(hr.padStart(2, '0'))
            setMinute(min.padStart(2, '0'))
            setWeekday(weekDay)
        } else if (month === '*' && weekDay === '*' && day !== '*' && !day.includes('*/')) {
            setFrequency('monthly')
            setHour(hr.padStart(2, '0'))
            setMinute(min.padStart(2, '0'))
            setDayOfMonth(day)
        } else {
            setFrequency('custom')
            setCustomInterval('5')
            setCustomUnit('minutes')
        }
    }

    const generateCronExpression = () => {
        switch (frequency) {
            case 'hourly':
                return `${parseInt(minute)} * * * *`
            case 'daily':
                return `${parseInt(minute)} ${parseInt(hour)} * * *`
            case 'weekly':
                return `${parseInt(minute)} ${parseInt(hour)} * * ${weekday}`
            case 'monthly':
                return `${parseInt(minute)} ${parseInt(hour)} ${dayOfMonth} * *`
            case 'custom': {
                const interval = parseInt(customInterval) || 5
                switch (customUnit) {
                    case 'minutes':
                        return `*/${interval} * * * *`
                    case 'hours':
                        return `0 */${interval} * * *`
                    case 'days':
                        return `0 0 */${interval} * *`
                    default:
                        return `*/${interval} * * * *`
                }
            }
            default:
                return '0 8 * * *'
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)

            const cronExpression = generateCronExpression()

            // Validate cron expression
            if (enabled && !cronExpression) {
                enqueueSnackbar({
                    message: 'Please configure a valid schedule',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                Dismiss
                            </Button>
                        )
                    }
                })
                return
            }

            const scheduleConfig = {
                enabled,
                cronExpression,
                timezone
            }

            await chatflowsApi.updateScheduleConfig(dialogProps.chatflow.id, scheduleConfig)

            enqueueSnackbar({
                message: 'Schedule configuration saved successfully',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            Dismiss
                        </Button>
                    )
                }
            })
        } catch (error) {
            console.error('Error saving schedule config:', error)
            enqueueSnackbar({
                message: `Failed to save schedule configuration: ${error.response?.data?.message || error.message}`,
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

    return (
        <Stack direction='column' spacing={3}>
            <Box>
                <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 1 }}>
                    <IconClock size={20} />
                    <Typography variant='h4'>Schedule Configuration</Typography>
                </Stack>
                <Typography variant='body2' color='textSecondary'>
                    Configure automatic execution of this flow on a schedule. The flow will run automatically based on your settings.
                </Typography>
            </Box>

            <FormControlLabel
                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} color='primary' />}
                label={
                    <Box>
                        <Typography variant='body1'>Enable Schedule</Typography>
                        <Typography variant='caption' color='textSecondary'>
                            Automatically run this flow based on the schedule below
                        </Typography>
                    </Box>
                }
            />

            {enabled && (
                <>
                    {/* Frequency Selector */}
                    <Box>
                        <Typography variant='subtitle2' sx={{ mb: 1 }}>
                            Frequency
                        </Typography>
                        <ToggleButtonGroup
                            value={frequency}
                            exclusive
                            onChange={(e, value) => value && setFrequency(value)}
                            aria-label='schedule frequency'
                            fullWidth
                        >
                            <ToggleButton value='hourly' aria-label='hourly'>
                                Hourly
                            </ToggleButton>
                            <ToggleButton value='daily' aria-label='daily'>
                                Daily
                            </ToggleButton>
                            <ToggleButton value='weekly' aria-label='weekly'>
                                Weekly
                            </ToggleButton>
                            <ToggleButton value='monthly' aria-label='monthly'>
                                Monthly
                            </ToggleButton>
                            <ToggleButton value='custom' aria-label='custom'>
                                Custom
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {/* Time Configuration */}
                    {frequency === 'hourly' && (
                        <Box>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                Run At
                            </Typography>
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <TimePicker
                                        label='Minute'
                                        value={dayjs().minute(parseInt(minute)).second(0)}
                                        onChange={(newValue) => {
                                            if (newValue) {
                                                setMinute(newValue.minute().toString().padStart(2, '0'))
                                            }
                                        }}
                                        views={['minutes']}
                                        format='mm'
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                helperText: 'Every hour at this minute'
                                            }
                                        }}
                                    />
                                </LocalizationProvider>
                            </Paper>
                        </Box>
                    )}

                    {(frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') && (
                        <Box>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                Time
                            </Typography>
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <TimePicker
                                        label='Select Time'
                                        value={dayjs().hour(parseInt(hour)).minute(parseInt(minute))}
                                        onChange={(newValue) => {
                                            if (newValue) {
                                                setHour(newValue.hour().toString().padStart(2, '0'))
                                                setMinute(newValue.minute().toString().padStart(2, '0'))
                                            }
                                        }}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                helperText: 'Pick the time to run this schedule'
                                            }
                                        }}
                                    />
                                </LocalizationProvider>
                            </Paper>
                        </Box>
                    )}

                    {frequency === 'weekly' && (
                        <Box>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                Day of Week
                            </Typography>
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <ToggleButtonGroup
                                    value={weekday}
                                    exclusive
                                    onChange={(e, value) => value && setWeekday(value)}
                                    aria-label='day of week'
                                    fullWidth
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(7, 1fr)',
                                        gap: 1
                                    }}
                                >
                                    {WEEKDAYS.map((day) => (
                                        <ToggleButton
                                            key={day.value}
                                            value={day.value}
                                            aria-label={day.label}
                                            sx={{
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            {day.label.substring(0, 3)}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Paper>
                        </Box>
                    )}

                    {frequency === 'monthly' && (
                        <Box>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                Day of Month
                            </Typography>
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <Select fullWidth value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} sx={{ mb: 1 }}>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <MenuItem key={day} value={day.toString()}>
                                            Day {day}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant='caption' color='textSecondary'>
                                    Select which day of the month to run
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {frequency === 'custom' && (
                        <Box>
                            <Typography variant='subtitle2' sx={{ mb: 1 }}>
                                Custom Interval
                            </Typography>
                            <Paper variant='outlined' sx={{ p: 2 }}>
                                <Stack direction='row' spacing={2} alignItems='center'>
                                    <Typography variant='body2' sx={{ whiteSpace: 'nowrap' }}>
                                        Every
                                    </Typography>
                                    <TextField
                                        type='number'
                                        value={customInterval}
                                        onChange={(e) => setCustomInterval(e.target.value)}
                                        inputProps={{ min: 1, max: 60 }}
                                        sx={{ width: '100px' }}
                                    />
                                    <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} sx={{ minWidth: '120px' }}>
                                        <MenuItem value='minutes'>Minutes</MenuItem>
                                        <MenuItem value='hours'>Hours</MenuItem>
                                        <MenuItem value='days'>Days</MenuItem>
                                    </Select>
                                </Stack>
                                <Typography variant='caption' color='textSecondary' sx={{ display: 'block', mt: 1 }}>
                                    Run every {customInterval} {customUnit}
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {/* Schedule Preview */}
                    <Paper
                        variant='outlined'
                        sx={{
                            p: 2.5,
                            background: theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.08)' : 'rgba(25, 118, 210, 0.08)',
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.5)' : 'rgba(25, 118, 210, 0.5)'
                        }}
                    >
                        <Stack direction='row' spacing={1.5} alignItems='center'>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    background: theme.palette.primary.main,
                                    color: 'white'
                                }}
                            >
                                <IconBell size={20} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant='caption' color='textSecondary' sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Schedule Preview
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 600, mt: 0.5 }}>
                                    {cronDescription}
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>

                    {/* Timezone */}
                    <FormControl fullWidth>
                        <InputLabel>Timezone</InputLabel>
                        <Select value={timezone} label='Timezone' onChange={(e) => setTimezone(e.target.value)}>
                            {TIMEZONES.map((tz) => (
                                <MenuItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Alert severity='info'>
                        <Typography variant='body2'>
                            <strong>Note:</strong>Note: Configure the initial prompt in your AI system message .
                        </Typography>
                    </Alert>
                </>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button variant='contained' color='primary' onClick={handleSave} disabled={saving || loading}>
                    {saving ? 'Saving...' : 'Save Schedule'}
                </Button>
            </Box>
        </Stack>
    )
}

Schedule.propTypes = {
    dialogProps: PropTypes.object
}

export default Schedule
