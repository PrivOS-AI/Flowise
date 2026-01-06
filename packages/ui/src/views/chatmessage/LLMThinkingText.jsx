import { memo, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import { IconBrain } from '@tabler/icons-react'
import { useTheme } from '@mui/material/styles'

/**
 * LLMThinkingText - Component hiển thị thinking process của LLM
 * Hiển thị process thinking của Claude khi extended thinking được bật
 */
const LLMThinkingText = ({ thinking, status }) => {
    const theme = useTheme()
    const [isThinkingComplete, setIsThinkingComplete] = useState(false)

    useEffect(() => {
        // Thinking hoàn thành khi status là FINISHED hoặc có thinking content
        if (status === 'FINISHED' || (thinking && thinking.length > 0)) {
            setIsThinkingComplete(true)
        }
    }, [thinking, status])

    // Không hiển thị nếu không có thinking
    if (!thinking || thinking.trim().length === 0) {
        return null
    }

    return (
        <Box
            sx={{
                width: '100%',
                mt: 1,
                mb: 1
            }}
        >
            <Accordion
                defaultExpanded
                sx={{
                    bgcolor: 'action.hover',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    boxShadow: 'none',
                    '&:before': {
                        display: 'none'
                    }
                }}
            >
                <AccordionSummary
                    expandIcon={<IconBrain size={16} />}
                    sx={{
                        minHeight: 48,
                        '& .MuiAccordionSummary-content': {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }
                    }}
                >
                    <IconBrain size={16} color={theme.palette.info.main} />
                    <Typography
                        variant='body2'
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary'
                        }}
                    >
                        Thinking Process
                    </Typography>
                    {!isThinkingComplete && (
                        <Typography
                            variant='caption'
                            sx={{
                                ml: 'auto',
                                color: 'text.secondary',
                                fontSize: '0.75rem'
                            }}
                        >
                            Đang suy nghĩ...
                        </Typography>
                    )}
                </AccordionSummary>
                <AccordionDetails
                    sx={{
                        pt: 0,
                        borderTop: `1px solid ${theme.palette.divider}`
                    }}
                >
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            lineHeight: 1.6
                        }}
                    >
                        {thinking}
                    </Typography>
                </AccordionDetails>
            </Accordion>
        </Box>
    )
}

LLMThinkingText.propTypes = {
    thinking: PropTypes.string,
    status: PropTypes.string
}

export default memo(LLMThinkingText)
