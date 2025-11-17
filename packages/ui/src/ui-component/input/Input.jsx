import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { FormControl, OutlinedInput, InputBase, Popover, Link, Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconExternalLink } from '@tabler/icons-react'
import SelectVariable from '@/ui-component/json/SelectVariable'
import { getAvailableNodesForVariable } from '@/utils/genericHelper'

export const Input = ({ inputParam, value, nodes, edges, nodeId, onChange, disabled = false }) => {
    const theme = useTheme()
    const [myValue, setMyValue] = useState(value ?? '')
    const [anchorEl, setAnchorEl] = useState(null)
    const [availableNodesForVariable, setAvailableNodesForVariable] = useState([])
    const ref = useRef(null)

    const openPopOver = Boolean(anchorEl)

    const handleClosePopOver = () => {
        setAnchorEl(null)
    }

    const setNewVal = (val) => {
        const newVal = myValue + val.substring(2)
        onChange(newVal)
        setMyValue(newVal)
    }

    const getInputType = (type) => {
        switch (type) {
            case 'string':
                return 'text'
            case 'password':
                return 'password'
            case 'number':
                return 'number'
            case 'email':
                return 'email'
            case 'date':
                return 'date'
            case 'datetime':
            case 'datetime-local':
                return 'datetime-local'
            case 'time':
                return 'time'
            default:
                return 'text'
        }
    }

    useEffect(() => {
        if (!disabled && nodes && edges && nodeId && inputParam) {
            const nodesForVariable = inputParam?.acceptVariable ? getAvailableNodesForVariable(nodes, edges, nodeId, inputParam.id) : []
            setAvailableNodesForVariable(nodesForVariable)
        }
    }, [disabled, inputParam, nodes, edges, nodeId])

    useEffect(() => {
        if (typeof myValue === 'string' && myValue && myValue.endsWith('{{')) {
            setAnchorEl(ref.current)
        }
    }, [myValue])

    // Check if this is a file URL field (not API endpoint)
    // Only show "Click to open" for file URLs in PrivOS nodes, not for LLM endpoints
    const isFileUrlField =
        inputParam.name &&
        myValue &&
        typeof myValue === 'string' &&
        (myValue.startsWith('http://') || myValue.startsWith('https://')) &&
        // Include: file-specific field names
        (inputParam.name.includes('file_url') ||
            inputParam.name.includes('fileUrl') ||
            inputParam.name.includes('cv_url') ||
            inputParam.name.includes('cvUrl') ||
            inputParam.name.includes('document_url') ||
            inputParam.name.includes('documentUrl') ||
            // OR: URL contains file/upload patterns
            myValue.includes('/upload/') ||
            myValue.includes('/file/') ||
            myValue.includes('/get-upload-file') ||
            myValue.includes('/api/v1/public-chatflows')) &&
        // Exclude: API endpoint field names
        !inputParam.name.toLowerCase().includes('baseurl') &&
        !inputParam.name.toLowerCase().includes('base_url') &&
        !inputParam.name.toLowerCase().includes('apiurl') &&
        !inputParam.name.toLowerCase().includes('api_url') &&
        !inputParam.name.toLowerCase().includes('endpoint')

    return (
        <>
            {inputParam.name === 'note' ? (
                <FormControl sx={{ width: '100%', height: 'auto' }} size='small'>
                    <InputBase
                        id={nodeId}
                        size='small'
                        disabled={disabled}
                        type={getInputType(inputParam.type)}
                        placeholder={inputParam.placeholder}
                        multiline={!!inputParam.rows}
                        minRows={inputParam.rows ?? 1}
                        value={myValue}
                        name={inputParam.name}
                        onChange={(e) => {
                            setMyValue(e.target.value)
                            onChange(e.target.value)
                        }}
                        inputProps={{
                            step: inputParam.step ?? 1,
                            style: {
                                border: 'none',
                                background: 'none',
                                color: 'inherit'
                            }
                        }}
                        sx={{
                            border: 'none',
                            background: 'none',
                            padding: '10px 14px',
                            textarea: {
                                '&::placeholder': {
                                    color: '#616161'
                                }
                            }
                        }}
                    />
                </FormControl>
            ) : (
                <FormControl sx={{ mt: 1, width: '100%' }} size='small'>
                    <OutlinedInput
                        id={inputParam.name}
                        size='small'
                        disabled={disabled}
                        type={getInputType(inputParam.type)}
                        placeholder={inputParam.placeholder}
                        multiline={!!inputParam.rows}
                        rows={inputParam.rows ?? 1}
                        value={myValue}
                        name={inputParam.name}
                        onChange={(e) => {
                            setMyValue(e.target.value)
                            onChange(e.target.value)
                        }}
                        inputProps={{
                            step: inputParam.step ?? 1,
                            style: {
                                height: inputParam.rows ? '90px' : 'inherit'
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.grey[900] + 25
                            }
                        }}
                    />
                </FormControl>
            )}

            {/* Render clickable link if this is a file URL field */}
            {isFileUrlField && (
                <Box sx={{ mt: 1, mb: 1 }}>
                    <Link
                        href={myValue}
                        target='_blank'
                        rel='noopener noreferrer'
                        underline='hover'
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontSize: '0.875rem',
                            color: theme.palette.primary.main,
                            cursor: 'pointer',
                            '&:hover': {
                                color: theme.palette.primary.dark
                            }
                        }}
                    >
                        <IconExternalLink size={16} />
                        Click to open in new tab
                    </Link>
                </Box>
            )}

            <div ref={ref}></div>
            {inputParam?.acceptVariable && (
                <Popover
                    open={openPopOver}
                    anchorEl={anchorEl}
                    onClose={handleClosePopOver}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left'
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left'
                    }}
                >
                    <SelectVariable
                        disabled={disabled}
                        availableNodesForVariable={availableNodesForVariable}
                        onSelectAndReturnVal={(val) => {
                            setNewVal(val)
                            handleClosePopOver()
                        }}
                    />
                </Popover>
            )}
        </>
    )
}

Input.propTypes = {
    inputParam: PropTypes.object,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func,
    disabled: PropTypes.bool,
    nodes: PropTypes.array,
    edges: PropTypes.array,
    nodeId: PropTypes.string
}
