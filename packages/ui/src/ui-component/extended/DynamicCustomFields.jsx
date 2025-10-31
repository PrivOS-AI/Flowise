import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import axios from 'axios'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

// Material
import { Box, TextField, CircularProgress, Typography, Chip, OutlinedInput } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// const
import { baseURL } from '@/store/constant'

const fetchFieldDefinitions = async ({ nodeData }) => {
    let credentialId = nodeData.credential
    if (!credentialId && (nodeData.inputs?.credential || nodeData.inputs?.['FLOWISE_CREDENTIAL_ID'])) {
        credentialId = nodeData.inputs.credential || nodeData.inputs?.['FLOWISE_CREDENTIAL_ID']
    }

    let config = {
        headers: {
            'x-request-from': 'internal',
            'Content-type': 'application/json'
        },
        withCredentials: true
    }

    let fields = await axios
        .post(
            `${baseURL}/api/v1/node-load-method/${nodeData.name}`,
            { ...nodeData, loadMethod: 'listFieldDefinitions', credential: credentialId },
            config
        )
        .then(async function (response) {
            return response.data
        })
        .catch(function (error) {
            console.error(error)
            return []
        })
    return fields
}

export const DynamicCustomFields = ({ name, nodeData, value, onSelect, disabled = false }) => {
    const theme = useTheme()

    const [fieldValues, setFieldValues] = useState({})
    const [availableFields, setAvailableFields] = useState([])
    const [loading, setLoading] = useState(false)

    console.log('[DynamicCustomFields] ========== COMPONENT MOUNTED! ==========')
    console.log('[DynamicCustomFields] Props:', { name, nodeData, value })
    console.log('[DynamicCustomFields] nodeData.inputs:', nodeData?.inputs)

    // Parse initial value
    useEffect(() => {
        if (value && value !== '') {
            try {
                const parsed = JSON.parse(value)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const valuesMap = {}
                    parsed.forEach((f) => {
                        valuesMap[f.fieldId] = f.value
                    })
                    setFieldValues(valuesMap)
                }
            } catch (error) {
                console.error('Error parsing initial value:', error)
            }
        }
    }, [])

    // Fetch available field definitions from backend
    useEffect(() => {
        // Only fetch if a list is selected
        const selectedList = nodeData.inputs?.selectedList
        if (!selectedList) {
            setAvailableFields([])
            setLoading(false)
            return
        }

        setLoading(true)
        ;(async () => {
            const fetchData = async () => {
                console.log('[DynamicCustomFields] Fetching field definitions for nodeData:', nodeData)
                const response = await fetchFieldDefinitions({ nodeData })
                console.log('[DynamicCustomFields] Field definitions response:', response)

                // Response should be array of field definitions with structure:
                // [{ label: "Assignees (USER)", name: "{\"fieldId\":\"...\",\"fieldName\":\"...\",\"fieldType\":\"...\"}", description: "Type: USER" }]
                const fields = (response || []).filter((f) => f.name !== '')

                // Parse field metadata from name (which is JSON string)
                const fieldsWithType = fields.map((f) => {
                    let fieldData
                    try {
                        // Parse the JSON metadata from name field
                        fieldData = JSON.parse(f.name)
                    } catch (e) {
                        // Fallback: extract from label if parse fails
                        console.warn('[DynamicCustomFields] Failed to parse field metadata:', f.name)
                        let fieldType = 'TEXT'
                        if (f.label) {
                            const match = f.label.match(/\(([A-Z_]+)\)/)
                            if (match) {
                                fieldType = match[1]
                            }
                        }
                        fieldData = {
                            fieldId: f.name,
                            fieldName: f.label?.replace(/\s*\([A-Z_]+\)\s*$/, '') || f.name,
                            fieldType: fieldType
                        }
                    }

                    return {
                        label: f.label,
                        fieldId: fieldData.fieldId,
                        name: fieldData.fieldName,
                        fieldType: fieldData.fieldType,
                        order: fieldData.order,
                        description: f.description
                    }
                })

                console.log('[DynamicCustomFields] Parsed fields:', fieldsWithType)
                setAvailableFields(fieldsWithType)
                setLoading(false)
            }
            fetchData()
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeData.credential, JSON.stringify(nodeData.inputs)])

    // Update parent when field values change
    useEffect(() => {
        const output = Object.entries(fieldValues)
            .filter(([fieldId, value]) => value !== null && value !== undefined && value !== '')
            .map(([fieldId, value]) => ({ fieldId, value }))
        onSelect(JSON.stringify(output))
    }, [fieldValues, onSelect])

    const handleFieldValueChange = (fieldId, newValue) => {
        setFieldValues((prev) => ({
            ...prev,
            [fieldId]: newValue
        }))
    }

    // Render field input based on type
    const renderFieldInput = (field) => {
        const fieldId = field.fieldId
        const fieldType = field.fieldType
        const currentValue = fieldValues[fieldId] || ''

        switch (fieldType) {
            case 'DATE':
            case 'DATE_TIME': {
                // Parse current value to Date object
                const dateValue = currentValue ? new Date(currentValue) : null

                return (
                    <Box sx={{ mt: 1 }}>
                        <DatePicker
                            selected={dateValue}
                            onChange={(date) => {
                                // Convert to ISO string for backend
                                const isoValue = date ? date.toISOString() : ''
                                setFieldValues((prev) => ({
                                    ...prev,
                                    [fieldId]: isoValue
                                }))
                            }}
                            showTimeSelect={fieldType === 'DATE_TIME'}
                            showTimeSelectOnly={false}
                            timeIntervals={15}
                            timeCaption='Time'
                            dateFormat={fieldType === 'DATE_TIME' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
                            placeholderText={fieldType === 'DATE_TIME' ? 'Select date and time' : 'Select date'}
                            disabled={disabled}
                            customInput={
                                <TextField
                                    size='small'
                                    fullWidth
                                    sx={{
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: theme.palette.grey[900] + 25
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover fieldset': {
                                                borderColor: theme.palette.primary.main
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: theme.palette.primary.main
                                            }
                                        }
                                    }}
                                />
                            }
                            wrapperClassName='datePicker'
                            className='form-control'
                        />
                    </Box>
                )
            }

            case 'TEXTAREA':
                return (
                    <OutlinedInput
                        size='small'
                        fullWidth
                        disabled={disabled}
                        placeholder={`Enter ${field.label || 'value'}`}
                        multiline
                        rows={4}
                        value={currentValue}
                        onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                )

            case 'USER':
                return (
                    <TextField
                        size='small'
                        fullWidth
                        disabled={disabled}
                        placeholder='Enter user data (JSON format with _id and username)'
                        value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)}
                        onChange={(e) => handleFieldValueChange(fieldId, e.target.value, fieldType)}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                )

            case 'FILE':
                return (
                    <TextField
                        size='small'
                        fullWidth
                        disabled={disabled}
                        placeholder='Enter file path or upload file'
                        value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)}
                        onChange={(e) => handleFieldValueChange(fieldId, e.target.value, fieldType)}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                )

            case 'DOCUMENT':
                return (
                    <OutlinedInput
                        size='small'
                        fullWidth
                        disabled={disabled}
                        placeholder='Enter documents (JSON array format: [{"title": "...", "content": "..."}])'
                        multiline
                        rows={3}
                        value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)}
                        onChange={(e) => handleFieldValueChange(fieldId, e.target.value, fieldType)}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                )

            case 'TEXT':
            case 'STRING':
            default:
                return (
                    <TextField
                        size='small'
                        fullWidth
                        disabled={disabled}
                        placeholder={`Enter ${field.label || 'value'}`}
                        value={currentValue}
                        onChange={(e) => handleFieldValueChange(fieldId, e.target.value)}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                )
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography sx={{ ml: 2 }}>Loading field definitions...</Typography>
            </Box>
        )
    }

    if (availableFields.length === 0 && !loading) {
        const selectedList = nodeData.inputs?.selectedList
        return (
            <Box sx={{ mt: 2, mb: 2 }}>
                <Typography color='textSecondary'>
                    {selectedList ? 'No field definitions available for this list' : 'Please select a list first'}
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant='subtitle2' sx={{ mb: 2, fontWeight: 500, color: theme.palette.primary.main }}>
                Custom Fields
            </Typography>

            {availableFields.map((field) => (
                <Box key={field.fieldId} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant='body2' sx={{ fontWeight: 500 }}>
                            {field.label?.replace(/\s*\([A-Z_]+\)\s*$/, '') || field.name}
                        </Typography>
                        <Chip
                            label={field.fieldType}
                            size='small'
                            sx={{
                                ml: 1,
                                height: 20,
                                fontSize: '0.65rem',
                                backgroundColor: theme.palette.secondary.light,
                                color: theme.palette.secondary.dark
                            }}
                        />
                        {field.description && (
                            <Typography variant='caption' color='textSecondary' sx={{ ml: 1 }}>
                                (optional)
                            </Typography>
                        )}
                    </Box>
                    {renderFieldInput(field)}
                </Box>
            ))}
        </Box>
    )
}

DynamicCustomFields.propTypes = {
    name: PropTypes.string,
    nodeData: PropTypes.object,
    value: PropTypes.string,
    onSelect: PropTypes.func,
    disabled: PropTypes.bool
}
