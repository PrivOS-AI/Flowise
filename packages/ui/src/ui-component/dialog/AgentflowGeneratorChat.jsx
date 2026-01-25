import PropTypes from 'prop-types'
import { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Box, Button, TextField, Paper, Typography, IconButton, Fab, useTheme, Card, Avatar, Tooltip, CircularProgress, alpha } from '@mui/material'

import { io } from 'socket.io-client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { flowContext } from '@/store/context/ReactFlowContext'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { nanoid } from 'nanoid'
import claudewsApi from '@/api/claudews'
import useApi from '@/hooks/useApi'
import { AnimatePresence, motion } from 'framer-motion'
import { RunningDots } from './RunningDots'

// Icons mapping for ToolUseBlock
import {
    IconMessageChatbot,
    IconX,
    IconSend,
    IconSparkles,
    IconPlugConnected,
    IconAlertTriangle,
    IconChevronDown,
    IconChevronRight,
    IconFileText,
    IconFilePlus,
    IconEdit,
    IconTerminal2,
    IconSearch,
    IconCheckbox,
    IconWorld,
    IconAlertCircle,
    IconBolt,
    IconCopy,
    IconCheck,
    IconFolder
} from '@tabler/icons-react'

// ==============================|| SUB-COMPONENTS ||============================== //

const ThinkingBlock = ({ content }) => {
    const [expanded, setExpanded] = useState(true)
    const theme = useTheme()

    return (
        <Box sx={{ mb: 1 }}>
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    color: theme.palette.text.secondary,
                    '&:hover': { color: theme.palette.text.primary }
                }}
            >
                {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                <RunningDots />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#b9664a' }}>
                    Thinking...
                </Typography>
            </Box>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <Box sx={{
                            pl: 3,
                            mt: 1,
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                            color: theme.palette.text.secondary,
                            typography: 'body2',
                            fontSize: '0.875rem'
                        }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                        </Box>
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    )
}

ThinkingBlock.propTypes = {
    content: PropTypes.string
}

const ToolUseBlock = ({ name, input, result, isError, isStreaming }) => {
    const [expanded, setExpanded] = useState(false)
    const theme = useTheme()

    // Icon mapping
    const getIcon = (toolName) => {
        const map = {
            Read: IconFileText,
            Write: IconFilePlus,
            Edit: IconEdit,
            Bash: IconTerminal2,
            Grep: IconSearch,
            Glob: IconFolder,
            TodoWrite: IconCheckbox,
            WebFetch: IconWorld,
            WebSearch: IconWorld,
            Skill: IconBolt
        }
        return map[toolName] || IconTerminal2
    }

    const Icon = getIcon(name)
    const isCompleted = !isStreaming && result

    // Determine display text
    const getDisplayText = () => {
        if (!input) return name
        if (name === 'Bash') return input.command || 'command...'
        if (name === 'Read' || name === 'Write' || name === 'Edit') return input.file_path || 'file...'
        if (name === 'Grep') return `"${input.pattern}"`
        if (name === 'WebSearch') return `"${input.query}"`
        return name
    }

    return (
        <Box sx={{
            my: 1,
            width: '100%',
            overflow: 'hidden',
            borderRadius: 1,
            border: `1px solid ${isStreaming ? alpha(theme.palette.primary.main, 0.2) : 'transparent'}`,
            bgcolor: isStreaming ? alpha(theme.palette.primary.main, 0.05) : 'transparent'
        }}>
            <Box
                onClick={() => (result || Object.keys(input || {}).length > 0) && setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    cursor: (result || Object.keys(input || {}).length > 0) ? 'pointer' : 'default',
                    '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.05) }
                }}
            >
                {/* Status Indicator */}
                {isCompleted ? (
                    <IconCheck size={14} color={theme.palette.success.main} />
                ) : isStreaming ? (
                    <RunningDots />
                ) : (
                    <Icon size={16} />
                )}

                {/* Content */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', flex: 1 }}>
                    {isStreaming && (
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            Processing
                        </Typography>
                    )}
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" noWrap>
                        {getDisplayText()}
                    </Typography>
                </Box>

                {isError && <IconAlertTriangle size={14} color={theme.palette.error.main} />}
            </Box>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                    >
                        <Box sx={{ p: 1, pl: 4, bgcolor: alpha(theme.palette.action.selected, 0.05) }}>
                            {name === 'Bash' && input?.command && (
                                <Box sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.75rem', color: theme.palette.text.primary }}>
                                    $ {input.command}
                                </Box>
                            )}
                            {result && (
                                <Box sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    color: isError ? theme.palette.error.light : theme.palette.text.secondary,
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: 200,
                                    overflowY: 'auto'
                                }}>
                                    {result}
                                </Box>
                            )}
                        </Box>
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    )
}

ToolUseBlock.propTypes = {
    name: PropTypes.string,
    input: PropTypes.object,
    result: PropTypes.string,
    isError: PropTypes.bool,
    isStreaming: PropTypes.bool
}
// ==============================|| AGENTFLOW GENERATOR CHAT ||============================== //

const AgentflowGeneratorChat = () => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)
    const messagesEndRef = useRef(null)

    const [activeServer, setActiveServer] = useState(null)
    const [isLoadingServer, setIsLoadingServer] = useState(false)

    const getAllServersApi = useApi(claudewsApi.getAllServers)

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))

    // Helper to scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Fetch Servers on Open
    useEffect(() => {
        if (open) {
            setIsLoadingServer(true)
            getAllServersApi.request()
        }
    }, [open])

    useEffect(() => {
        if (getAllServersApi.data) {
            setIsLoadingServer(false)
            // Find active or first server
            const servers = getAllServersApi.data
            console.log('Fetched Servers:', servers)
            const active = servers.find(s => s.isActive) || servers[0]
            if (active) {
                console.log('Active Server Found:', active)
                setActiveServer(active)
            } else {
                console.warn('No active server found')
            }
        } else if (getAllServersApi.error) {
            console.error('Failed to fetch servers:', getAllServersApi.error)
            setIsLoadingServer(false)
        }
    }, [getAllServersApi.data, getAllServersApi.error])

    // Initialize Socket
    useEffect(() => {
        if (open && activeServer && !socketRef.current) {
            // activeServer should have endpointUrl or host/port
            let url = 'http://localhost:3000'

            if (activeServer.endpointUrl) {
                // If endpointUrl is present (standard for claudews server config)
                url = activeServer.endpointUrl
            } else if (activeServer.host) {
                // Fallback for legacy or other formats
                const protocol = activeServer.protocol || 'http'
                const host = activeServer.host || 'localhost'
                const port = activeServer.port || 3000
                url = `${protocol}://${host}:${port}`
            }


            console.log('Connecting to Claude WS at', url)

            const socket = io(url, {
                reconnection: true,
                reconnectionDelay: 1000
            })

            socketRef.current = socket

            socket.on('connect', () => {
                console.log('Connected to Claude WS', socket.id)
                setIsConnected(true)
            })

            socket.on('disconnect', () => {
                console.log('Disconnected from Claude WS')
                setIsConnected(false)
            })

            socket.on('error', (error) => {
                console.error('Socket error:', error)
                enqueueSnackbar({
                    message: `Socket Error: ${error.message || 'Unknown error'}`,
                    options: {
                        variant: 'error'
                    }
                })
            })

            const handleOutputJson = (payload) => {
                const { data } = payload

                setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMsgIndex = newMessages.length - 1
                    const lastMsg = newMessages[lastMsgIndex]

                    // Handle Complete/Snapshot Messages (Assistant/User)
                    if (data.type === 'assistant' || data.type === 'user') {
                        const { message } = data
                        // Check if we should update the last message or append a new one
                        // If last message is streaming and role matches, likely an update/snapshot
                        if (lastMsg && lastMsg.isStreaming && lastMsg.role === message.role) {
                            newMessages[lastMsgIndex] = {
                                ...lastMsg,
                                content: message.content, // Replace content with latest snapshot
                                id: message.id || lastMsg.id, // Update ID if provided
                            }
                            return newMessages
                        } else {
                            // Append new message
                            return [...newMessages, {
                                role: message.role,
                                content: message.content,
                                id: message.id || nanoid(),
                                isStreaming: true // Assume streaming until result/stop
                            }]
                        }
                    }

                    // Handle 'result' -> Stop streaming
                    if (data.type === 'result') {
                        if (lastMsg) {
                            newMessages[lastMsgIndex] = { ...lastMsg, isStreaming: false }
                        }
                        setIsStreaming(false)
                        return newMessages
                    }

                    // Handle Content Block Delta (Streaming)
                    if (data.type === 'content_block_delta') {
                        // Ensure we have a message to append to
                        if (!lastMsg || lastMsg.role !== 'assistant') {
                            // Force create a streaming assistant message if missing
                            return [...newMessages, {
                                role: 'assistant',
                                content: [], // Initialize empty block array
                                id: nanoid(),
                                isStreaming: true
                            }]
                        }

                        // Re-fetch lastMsg after potential append (optimization: just use logic below for next render, but here we need to handle it now)
                        // Actually, if we just returned, the NEXT event will catch it. But we don't want to drop THIS delta.
                        // So let's handle the case where we need to create AND append.

                        let targetMsgIndex = lastMsgIndex
                        let targetMsg = lastMsg

                        if (!targetMsg || targetMsg.role !== 'assistant') {
                            targetMsg = { role: 'assistant', content: [], id: nanoid(), isStreaming: true }
                            newMessages.push(targetMsg)
                            targetMsgIndex = newMessages.length - 1
                        }

                        // Now apply delta to targetMsg
                        if (Array.isArray(targetMsg.content)) {
                            const newContent = [...targetMsg.content]
                            const blockIndex = data.index

                            // Ensure block exists
                            if (!newContent[blockIndex]) {
                                // Initialize block based on delta type
                                if (data.delta.type === 'text_delta') newContent[blockIndex] = { type: 'text', text: '' }
                                else if (data.delta.type === 'thinking_delta') newContent[blockIndex] = { type: 'thinking', thinking: '' }
                                // tool_use/result usually come as full blocks in other events or need separate handling if streamed
                            }

                            const block = newContent[blockIndex]
                            if (block) {
                                if (data.delta.type === 'text_delta') {
                                    block.text = (block.text || '') + data.delta.text
                                } else if (data.delta.type === 'thinking_delta') {
                                    block.thinking = (block.thinking || '') + data.delta.thinking
                                }
                                newMessages[targetMsgIndex] = { ...targetMsg, content: newContent }
                                return newMessages
                            }
                        }
                    }

                    return prev
                })
            }

            socket.on('output:json', handleOutputJson)

            // Listen for attempting started to confirm task creation
            socket.on('attempt:started', (data) => {
                console.log('Attempt started:', data)
                setIsStreaming(true)
                // No need to explicit subscribe if we just started it, but if it was an existing attempt we might
            })

            // Listen for any output/response
            socket.on('output:stderr', (data) => {
                console.log('Stderr:', data)
            })

        }

        return () => {
            if (socketRef.current) {
                // socketRef.current.disconnect() // Optional: keep active or disconnect
            }
        }
    }, [open, activeServer]) // Depend on activeServer

    const handleSendMessage = () => {
        if (!input.trim() || !socketRef.current) return

        const userMessage = input.trim()
        addMessage('user', userMessage)
        setInput('')
        setIsStreaming(true)

        // Emit attempt:start to trigger the agent
        const taskId = nanoid()
        const payload = {
            taskId: taskId,
            prompt: userMessage,
            force_create: true,
            projectId: 'flowise-generator-project', // Fixed project for generation tasks
            projectName: 'Flowise Generator',
            taskTitle: `Generate Flow: ${userMessage.substring(0, 20)}...`,
            outputFormat: 'json' // Request JSON output for the flow
        }

        console.log('Sending prompt:', payload)
        socketRef.current.emit('attempt:start', payload)
    }

    // Custom renderer for Markdown
    const MarkdownComponents = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
                <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            )
        }
    }

    const addMessage = (role, content) => {
        setMessages((prev) => [...prev, { role, content, id: nanoid(), timestamp: new Date() }])
    }

    return (
        <Box sx={{ position: 'fixed', bottom: 30, right: 30, zIndex: theme.zIndex.appBar + 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{ transformOrigin: 'bottom right' }}
                    >
                        <Paper
                            elevation={12}
                            sx={{
                                width: 400,
                                height: 600,
                                mb: 2,
                                borderRadius: 3,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                backdropFilter: 'blur(12px)',
                                bgcolor: alpha(theme.palette.background.paper, 0.85),
                                boxShadow: theme.customShadows?.primary || '0 12px 24px -4px rgba(0, 0, 0, 0.2)'
                            }}
                        >
                            {/* Header */}
                            <Box
                                sx={{
                                    p: 2,
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                    color: 'white',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IconSparkles size={20} />
                                    <Typography variant="h4" color="inherit" sx={{ fontWeight: 600 }}>
                                        Agent Generator
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    {activeServer && (
                                        <Tooltip title={isConnected ? `Connected to ${activeServer.name}` : `Connecting to ${activeServer.name}...`}>
                                            <IconPlugConnected size={18} color={isConnected ? '#4caf50' : alpha('#fff', 0.5)} />
                                        </Tooltip>
                                    )}
                                    <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white', '&:hover': { bgcolor: alpha('#fff', 0.1) } }}>
                                        <IconX size={20} />
                                    </IconButton>
                                </Box>
                            </Box>

                            {/* Messages Area */}
                            <Box
                                sx={{
                                    flex: 1,
                                    p: 2,
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2
                                }}
                            >
                                {isLoadingServer && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                                        <CircularProgress size={24} />
                                    </Box>
                                )}

                                {!isLoadingServer && !activeServer && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, opacity: 0.7, px: 3, textAlign: 'center' }}>
                                        <IconAlertTriangle size={48} stroke={1} color={theme.palette.warning.main} />
                                        <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
                                            No Claude WS Server Found
                                        </Typography>
                                        <Typography variant="caption" sx={{ mt: 1 }}>
                                            Please configure a server in Claude WS settings.
                                        </Typography>
                                    </Box>
                                )}

                                {!isLoadingServer && activeServer && messages.length === 0 && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, opacity: 0.7 }}>
                                        <IconSparkles size={48} stroke={1} />
                                        <Typography variant="body1" sx={{ mt: 2 }}>
                                            Describe the agent flow you want to build.
                                        </Typography>
                                    </Box>
                                )}

                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        style={{
                                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            maxWidth: '90%',
                                            width: msg.role === 'assistant' ? '100%' : 'auto'
                                        }}
                                    >
                                        <Paper
                                            elevation={0}
                                            sx={{
                                                p: 1.5,
                                                px: 2,
                                                bgcolor: msg.role === 'user'
                                                    ? theme.palette.primary.light
                                                    : 'transparent', // Transparent for assistant to show blocks naturally
                                                color: msg.role === 'user' ? theme.palette.primary.contrastText : theme.palette.text.primary,
                                                borderRadius: 2,
                                                borderTopRightRadius: msg.role === 'user' ? 0 : 2,
                                                borderTopLeftRadius: msg.role === 'assistant' ? 0 : 2,
                                                boxShadow: msg.role === 'user' ? 1 : 'none'
                                            }}
                                        >
                                            {msg.role === 'user' ? (
                                                <Typography variant="body2">
                                                    {(() => {
                                                        const rawText = Array.isArray(msg.content)
                                                            ? msg.content.map(b => b.text).join('')
                                                            : msg.content
                                                        return rawText.split('=== REQUIRED OUTPUT ===')[0].trim()
                                                    })()}
                                                </Typography>
                                            ) : (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {Array.isArray(msg.content) ? (
                                                        msg.content.map((block, i) => {
                                                            if (block.type === 'thinking') {
                                                                return <ThinkingBlock key={i} content={block.thinking} />
                                                            }
                                                            if (block.type === 'tool_use') {
                                                                // Find result in subsequent messages
                                                                let result = null
                                                                let isError = false
                                                                // Simple lookahead for tool_result in same or next messages
                                                                // This is O(N*M) but N is small
                                                                for (let j = index; j < messages.length; j++) {
                                                                    const m = messages[j]
                                                                    if (Array.isArray(m.content)) {
                                                                        const resultBlock = m.content.find(b => b.type === 'tool_result' && b.tool_use_id === block.id)
                                                                        if (resultBlock) {
                                                                            // Assuming result content is in 'content' field or we parse it
                                                                            result = typeof resultBlock.content === 'string' ? resultBlock.content : JSON.stringify(resultBlock.content)
                                                                            isError = resultBlock.is_error
                                                                            break
                                                                        }
                                                                    }
                                                                }

                                                                return (
                                                                    <ToolUseBlock
                                                                        key={i}
                                                                        name={block.name}
                                                                        input={block.input}
                                                                        result={result}
                                                                        isError={isError}
                                                                        isStreaming={msg.isStreaming && i === msg.content.length - 1 && !result}
                                                                    />
                                                                )
                                                            }
                                                            if (block.type === 'text') {
                                                                return (
                                                                    <ReactMarkdown
                                                                        key={i}
                                                                        remarkPlugins={[remarkGfm]}
                                                                        components={MarkdownComponents}
                                                                    >
                                                                        {block.text}
                                                                    </ReactMarkdown>
                                                                )
                                                            }
                                                            return null
                                                        })
                                                    ) : (
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={MarkdownComponents}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    )}
                                                    {/* Show running dots if streaming */}
                                                    {msg.isStreaming && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theme.palette.text.secondary }}>
                                                            <RunningDots />
                                                        </Box>
                                                    )}
                                                </Box>
                                            )}
                                        </Paper>
                                    </motion.div>
                                ))}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* Input Area */}
                            <Box sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder={isConnected ? "Describe your agent..." : (activeServer ? "Connecting..." : "No server configured")}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage()
                                            }
                                        }}
                                        disabled={!isConnected || isStreaming || !activeServer}
                                        multiline
                                        maxRows={4}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 3,
                                                bgcolor: alpha(theme.palette.background.default, 0.7)
                                            }
                                        }}
                                    />
                                    <IconButton
                                        color="primary"
                                        onClick={handleSendMessage}
                                        disabled={!input.trim() || !isConnected || isStreaming}
                                        sx={{
                                            bgcolor: input.trim() ? theme.palette.primary.main : 'transparent',
                                            color: input.trim() ? '#fff' : 'inherit',
                                            '&:hover': {
                                                bgcolor: theme.palette.primary.dark
                                            }
                                        }}
                                    >
                                        <IconSend size={20} />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Paper>
                    </motion.div>
                )}
            </AnimatePresence>

            <Tooltip title="Generate Agent Flow" placement="left">
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <Fab
                        color="primary"
                        aria-label="generate"
                        onClick={() => setOpen(!open)}
                        sx={{
                            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                            boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                        }}
                    >
                        <Box sx={{ width: 24, height: 24, position: 'relative' }}>
                            <AnimatePresence mode="wait">
                                {open ? (
                                    <motion.div
                                        key="close"
                                        initial={{ opacity: 0, rotate: -90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: 90 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <IconX size={24} />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="chat"
                                        initial={{ opacity: 0, rotate: 90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: -90 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <IconMessageChatbot size={24} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Box>
                    </Fab>
                </motion.div>
            </Tooltip>
        </Box>
    )
}

AgentflowGeneratorChat.propTypes = {
}

export default AgentflowGeneratorChat
