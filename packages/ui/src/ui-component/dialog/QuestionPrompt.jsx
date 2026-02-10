import PropTypes from 'prop-types'
import { useState, useEffect, useRef } from 'react'
import {
    Box,
    Typography,
    Button,
    TextField,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Checkbox,
    useTheme,
    alpha,
    Chip,
    Paper
} from '@mui/material'
import { IconChevronRight } from '@tabler/icons-react'

const QuestionPrompt = ({ questions, onAnswer, onCancel }) => {
    const theme = useTheme()
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [selectedMulti, setSelectedMulti] = useState(new Set())
    const [customInput, setCustomInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [answers, setAnswers] = useState({})
    const inputRef = useRef(null)

    const currentQuestion = questions[currentQuestionIndex]
    // Add "Type something" as last option
    const allOptions = [...(currentQuestion.options || []), { label: 'Type something.', description: '' }]
    const isLastOption = selectedIndex === allOptions.length - 1

    // Reset state when question changes
    useEffect(() => {
        setSelectedIndex(0)
        setSelectedMulti(new Set())
        setCustomInput('')
        setIsTyping(false)
    }, [currentQuestionIndex])

    const handleSubmitAnswer = (answer) => {
        const answerValue = Array.isArray(answer) ? answer.join(', ') : answer
        const newAnswers = { ...answers, [currentQuestion.question]: answerValue }
        setAnswers(newAnswers)

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1)
        } else {
            onAnswer(newAnswers)
        }
    }

    const handleMultiSubmit = () => {
        if (selectedMulti.size === 0) return
        const selectedLabels = Array.from(selectedMulti).map((i) => allOptions[i].label)
        handleSubmitAnswer(selectedLabels)
    }

    const handleOptionClick = (index) => {
        setSelectedIndex(index)
        const isTypeOption = index === allOptions.length - 1

        if (isTypeOption) {
            setIsTyping(true)
            setTimeout(() => inputRef.current?.focus(), 0)
        } else if (currentQuestion.multiSelect) {
            setSelectedMulti((prev) => {
                const next = new Set(prev)
                if (next.has(index)) next.delete(index)
                else next.add(index)
                return next
            })
        } else {
            handleSubmitAnswer(allOptions[index].label)
        }
    }

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isTyping) {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    setIsTyping(false)
                    setCustomInput('')
                } else if (e.key === 'Enter' && customInput.trim()) {
                    e.preventDefault()
                    handleSubmitAnswer(customInput.trim())
                }
                return
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.min(prev + 1, allOptions.length - 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                handleOptionClick(selectedIndex)
            } else if (e.key === ' ' && currentQuestion.multiSelect && !isLastOption) {
                e.preventDefault()
                setSelectedMulti((prev) => {
                    const next = new Set(prev)
                    if (next.has(selectedIndex)) next.delete(selectedIndex)
                    else next.add(selectedIndex)
                    return next
                })
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
            } else if (/^[1-9]$/.test(e.key)) {
                const num = parseInt(e.key, 10) - 1
                if (num < allOptions.length) {
                    handleOptionClick(num)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedIndex, isTyping, customInput, currentQuestion, allOptions.length, isLastOption, selectedMulti])

    return (
        <Paper
            elevation={3}
            sx={{
                p: 2,
                mt: 2,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                backgroundColor: theme.palette.background.paper
            }}
        >
            <Box sx={{ mb: 2 }}>
                <Chip
                    label={currentQuestion.header}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ mb: 1 }}
                />
                <Typography variant="subtitle1" fontWeight="bold">
                    {currentQuestion.question}
                </Typography>
            </Box>

            <List disablePadding>
                {allOptions.map((option, index) => {
                    const isSelected = selectedIndex === index
                    const isChecked = selectedMulti.has(index)
                    const isTypeOption = index === allOptions.length - 1

                    return (
                        <ListItem
                            key={index}
                            disablePadding
                            sx={{ mb: 0.5 }}
                        >
                            <ListItemButton
                                selected={isSelected}
                                onClick={() => handleOptionClick(index)}
                                sx={{
                                    borderRadius: 1,
                                    border: `1px solid ${isSelected ? theme.palette.primary.main : 'transparent'}`,
                                    '&.Mui-selected': {
                                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.2)
                                        }
                                    }
                                }}
                            >
                                {currentQuestion.multiSelect && !isTypeOption && (
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        <Checkbox
                                            edge="start"
                                            checked={isChecked}
                                            tabIndex={-1}
                                            disableRipple
                                            size="small"
                                            sx={{ p: 0 }}
                                        />
                                    </ListItemIcon>
                                )}
                                <ListItemIcon sx={{ minWidth: 24, display: currentQuestion.multiSelect && !isTypeOption ? 'none' : 'flex' }}>
                                    {isSelected ? <IconChevronRight size={16} color={theme.palette.primary.main} /> : <Box sx={{ width: 16 }} />}
                                </ListItemIcon>

                                <ListItemText
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                                                {index + 1}. {option.label}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={option.description ? (
                                        <Typography variant="caption" color="text.secondary">
                                            {option.description}
                                        </Typography>
                                    ) : null}
                                />
                            </ListItemButton>
                        </ListItem>
                    )
                })}
            </List>

            {isTyping && (
                <Box sx={{ mt: 2, px: 1 }}>
                    <TextField
                        inputRef={inputRef}
                        fullWidth
                        size="small"
                        variant="outlined"
                        placeholder="Type your answer..."
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter' && customInput.trim()) {
                                e.preventDefault()
                                handleSubmitAnswer(customInput.trim())
                            }
                        }}
                    />
                </Box>
            )}

            {currentQuestion.multiSelect && selectedMulti.size > 0 && (
                <Box sx={{ mt: 2, px: 1 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleMultiSubmit}
                        fullWidth
                    >
                        Submit ({selectedMulti.size} selected)
                    </Button>
                </Box>
            )}

            <Box sx={{ mt: 2, pt: 1, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', gap: 2, color: theme.palette.text.secondary }}>
                <Typography variant="caption">Start typing or use</Typography>
                <Typography variant="caption" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 0.5 }}>Enter</Typography>
                <Typography variant="caption" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 0.5 }}>↑/↓</Typography>
                <Typography variant="caption" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 0.5 }}>Esc</Typography>
            </Box>
        </Paper>
    )
}

QuestionPrompt.propTypes = {
    questions: PropTypes.array.isRequired,
    onAnswer: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
}

export default QuestionPrompt
