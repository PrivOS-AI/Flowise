import { memo, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, Collapse, IconButton } from '@mui/material'
import { IconLoader, IconCheck, IconAlertCircle, IconChevronDown } from '@tabler/icons-react'
import { useTheme } from '@mui/material/styles'

const ExecutionStepItem = memo(function ExecutionStepItem({ step, theme, getStepIcon }) {
    const content = step.executionLabel || ''

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 1.5,
                px: 1.5,
                py: 1.2,
                borderRadius: '8px',
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
                mb: 1
            }}
        >
            <Box sx={{ mt: 0.3 }}>{getStepIcon(step.status)}</Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    variant='caption'
                    sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        display: 'block'
                    }}
                >
                    {content}
                </Typography>
            </Box>
        </Box>
    )
})

ExecutionStepItem.propTypes = {
    step: PropTypes.shape({
        status: PropTypes.string,
        executionLabel: PropTypes.string,
        nodeId: PropTypes.string
    }).isRequired,
    theme: PropTypes.object.isRequired,
    getStepIcon: PropTypes.func.isRequired
}

const AgentProgressText = memo(function AgentProgressText({ execution }) {
    const theme = useTheme()
    const [expandedAll, setExpandedAll] = useState(true)

    const getStepIcon = (stepStatus) => {
        const iconProps = { size: 16, stroke: 1.5 }

        if (stepStatus === 'FINISHED') {
            return <IconCheck {...iconProps} color={theme.palette.success.main} />
        }

        if (stepStatus === 'ERROR') {
            return <IconAlertCircle {...iconProps} color={theme.palette.error.main} />
        }

        if (stepStatus === 'INPROGRESS') {
            return (
                <Box
                    sx={{
                        animation: 'spin 2s linear infinite',
                        '@keyframes spin': {
                            '100%': { transform: 'rotate(360deg)' }
                        }
                    }}
                >
                    <IconLoader {...iconProps} color={theme.palette.primary.main} />
                </Box>
            )
        }

        return (
            <Box
                sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: `2px solid ${theme.palette.action.disabled}`
                }}
            />
        )
    }

    if (!execution.length) return null

    return (
        <Box sx={{ width: '100%' }}>
            <Box
                onClick={() => setExpandedAll(!expandedAll)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 1
                }}
            >
                <IconButton
                    size='small'
                    sx={{
                        transform: expandedAll ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s'
                    }}
                >
                    <IconChevronDown size={18} />
                </IconButton>

                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                    Tiến trình Agent
                </Typography>
            </Box>

            <Collapse in={expandedAll}>
                {execution.map((step, index) => (
                    <ExecutionStepItem key={step.nodeId || index} step={step} theme={theme} getStepIcon={getStepIcon} />
                ))}
            </Collapse>
        </Box>
    )
})

AgentProgressText.propTypes = {
    execution: PropTypes.arrayOf(
        PropTypes.shape({
            nodeId: PropTypes.string,
            status: PropTypes.string,
            executionLabel: PropTypes.string
        })
    )
}

AgentProgressText.defaultProps = {
    execution: []
}

export default AgentProgressText
