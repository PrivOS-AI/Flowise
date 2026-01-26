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

const useTypewriter = (text, isStreaming) => {
    const [display, setDisplay] = useState(text)

    useEffect(() => {
        if (!isStreaming) {
            setDisplay(text)
            return
        }
        setDisplay(text)
    }, [text, isStreaming])

    return display
}

const MessageBlock = ({ content, isThinking, isStreaming }) => {
    const theme = useTheme()

    // Custom Markdown Components matching claudews style
    const MarkdownComponents = {
        h1: ({ children }) => <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>{children}</Typography>,
        h2: ({ children }) => <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>{children}</Typography>,
        h3: ({ children }) => <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 1, fontWeight: 600 }}>{children}</Typography>,
        p: ({ children }) => <Typography variant="body2" sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>{children}</Typography>,
        ul: ({ children }) => <Box component="ul" sx={{ pl: 2.5, mb: 1.5 }}>{children}</Box>,
        ol: ({ children }) => <Box component="ol" sx={{ pl: 2.5, mb: 1.5 }}>{children}</Box>,
        li: ({ children }) => <Typography component="li" variant="body2">{children}</Typography>,
        a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main, textDecoration: 'underline' }}>
                {children}
            </a>
        ),
        blockquote: ({ children }) => (
            <Box sx={{ borderLeft: `3px solid ${theme.palette.divider}`, pl: 2, my: 1.5, fontStyle: 'italic', color: theme.palette.text.secondary }}>
                {children}
            </Box>
        ),
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
                <Box sx={{ my: 1.5, borderRadius: 1, overflow: 'hidden' }}>
                    <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: 0 }}
                        {...props}
                    >
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </Box>
            ) : (
                <code className={className} style={{
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    padding: '2px 4px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: '0.85em'
                }} {...props}>
                    {children}
                </code>
            )
        },
        table: ({ children }) => <Box sx={{ overflowX: 'auto', my: 2 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></Box>,
        th: ({ children }) => <th style={{ border: `1px solid ${theme.palette.divider}`, padding: 8, background: alpha(theme.palette.action.hover, 0.1) }}>{children}</th>,
        td: ({ children }) => <td style={{ border: `1px solid ${theme.palette.divider}`, padding: 8 }}>{children}</td>,
    }

    return (
        <Box sx={{ typography: 'body2' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                {content}
            </ReactMarkdown>
        </Box>
    )
}

MessageBlock.propTypes = {
    content: PropTypes.string,
    isThinking: PropTypes.bool,
    isStreaming: PropTypes.bool
}

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
    const scrollContainerRef = useRef(null)

    const [activeServer, setActiveServer] = useState(null)
    const [isLoadingServer, setIsLoadingServer] = useState(false)
    const userScrollingRef = useRef(false)
    const userScrollTimeoutRef = useRef(null)

    const getAllServersApi = useApi(claudewsApi.getAllServers)

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))

    // Helper functions for Tool Logic (Ported from claudews)
    const buildToolResultsMap = (msgs) => {
        const map = new Map()
        for (const msg of msgs) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (block.type === 'tool_result' && (block.tool_use_id || block.id)) {
                            const toolUseId = block.tool_use_id || block.id
                            let resultStr = ''
                            if (typeof block.content === 'string') {
                                resultStr = block.content
                            } else if (block.content && typeof block.content === 'object') {
                                resultStr = JSON.stringify(block.content)
                            }
                            map.set(toolUseId, {
                                result: resultStr,
                                isError: block.is_error || false
                            })
                        }
                    }
                }
            }
        }
        return map
    }

    const findLastToolUseId = (msgs) => {
        let lastToolUseId = null
        for (const msg of msgs) {
            if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use' && block.id) {
                        lastToolUseId = block.id
                    }
                }
            }
        }
        return lastToolUseId
    }

    const isToolExecuting = (toolId, lastToolUseId, toolResultsMap, isGlobalStreaming) => {
        if (!isGlobalStreaming) return false
        if (toolResultsMap.has(toolId)) return false
        return toolId === lastToolUseId
    }

    // Smart Auto-scroll Logic
    const isNearBottom = () => {
        const container = scrollContainerRef.current
        if (!container) return true
        const threshold = 150
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    }

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }

    // Detect user scroll
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            userScrollingRef.current = true
            if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current)

            userScrollTimeoutRef.current = setTimeout(() => {
                if (isNearBottom()) {
                    userScrollingRef.current = false
                }
            }, 150)
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        return () => container.removeEventListener('scroll', handleScroll)
    }, [open])

    // Auto-scroll on messages change if not manually scrolling
    useEffect(() => {
        if (!userScrollingRef.current) {
            scrollToBottom()
        }
    }, [messages, isStreaming])


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
            // Calculate target URL based on activeServer config
            let targetUrl = 'http://localhost:8556'
            if (activeServer.endpointUrl) {
                targetUrl = activeServer.endpointUrl
            } else if (activeServer.host) {
                const protocol = activeServer.protocol || 'http'
                const host = activeServer.host || 'localhost'
                const port = activeServer.port || 3000
                targetUrl = `${protocol}://${host}:${port}`
            }

            // Use Flowise Backend Proxy to talk to ClaudeWS
            // Pass the target URL so the backend knows where to forward
            const proxyUrl = window.location.origin
            console.log('Connecting to Claude WS via Proxy at', proxyUrl, 'Target:', targetUrl)

            const socket = io(proxyUrl, {
                path: '/claudews-socket/socket.io',
                query: {
                    claudews_target: targetUrl
                },
                reconnection: true,
                reconnectionDelay: 1000,
                transports: ['websocket', 'polling']
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

                    // Handle Complete/Snapshot Messages (Assistant Only - Ignore User to avoid duplication)
                    if (data.type === 'assistant') {
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
            })

            // Listen for any output/response
            socket.on('output:stderr', (data) => {
                console.log('Stderr:', data)
            })

        }

        return () => {
        }
    }, [open, activeServer])

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

    const addMessage = (role, content) => {
        setMessages((prev) => [...prev, { role, content, id: nanoid(), timestamp: new Date() }])
    }

    // Check if messages have visible content (text, thinking, or tool_use)
    const hasVisibleContent = (msgs) => {
        return msgs.some(msg => {
            if (msg.role === 'assistant' && Array.isArray(msg.content) && msg.content.length > 0) {
                return msg.content.some(block =>
                    (block.type === 'text' && block.text) ||
                    (block.type === 'thinking' && block.thinking) ||
                    block.type === 'tool_use'
                )
            }
            return false
        })
    }

    // Prepare maps for rendering
    const toolResultsMap = buildToolResultsMap(messages)
    const lastToolUseId = findLastToolUseId(messages)
    const showLoadingDots = isStreaming && !hasVisibleContent(messages)

    const renderContentBlock = (block, index, msgIsStreaming) => {
        if (block.type === 'text' && block.text) {
            return <MessageBlock key={index} content={block.text} isStreaming={msgIsStreaming} />
        }

        if (block.type === 'thinking' && block.thinking) {
            return <MessageBlock key={index} content={block.thinking} isThinking isStreaming={msgIsStreaming} />
        }

        if (block.type === 'tool_use') {
            const toolId = block.id || ''
            const toolResult = toolResultsMap.get(toolId)
            // Check if this tool is the one currently executing
            const executing = isToolExecuting(toolId, lastToolUseId, toolResultsMap, isStreaming)

            return (
                <ToolUseBlock
                    key={index}
                    name={block.name || 'Unknown'}
                    input={block.input}
                    result={toolResult?.result}
                    isError={toolResult?.isError}
                    isStreaming={executing}
                />
            )
        }

        if (block.type === 'tool_result') {
            // Tool results are typically shown inline with tool_use via map
            return null
        }

        return null
    }

    const renderMessage = (msg, index) => {
        if (msg.role === 'user') {
            const rawText = Array.isArray(msg.content)
                ? msg.content.map(b => b.text).join('')
                : (typeof msg.content === 'string' ? msg.content : '')
            const displayText = rawText.split('=== REQUIRED OUTPUT ===')[0].trim()

            if (!displayText) return null

            return (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        alignSelf: 'flex-end',
                        maxWidth: '90%',
                        width: 'auto'
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: 1.5,
                            px: 2,
                            bgcolor: theme.palette.primary.light,
                            color: theme.palette.primary.contrastText,
                            borderRadius: 2,
                            borderTopRightRadius: 0,
                            boxShadow: 1
                        }}
                    >
                        <Typography variant="body2">
                            {displayText}
                        </Typography>
                    </Paper>
                </motion.div>
            )
        }

        if (msg.role === 'assistant') {
            return (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        alignSelf: 'flex-start',
                        maxWidth: '90%',
                        width: '100%'
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: 1.5,
                            px: 2,
                            bgcolor: 'transparent',
                            color: theme.palette.text.primary,
                            borderRadius: 2,
                            borderTopLeftRadius: 0,
                            boxShadow: 'none'
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {Array.isArray(msg.content) ? (
                                msg.content.map((block, i) => renderContentBlock(block, i, msg.isStreaming && i === msg.content.length - 1))
                            ) : (
                                <MessageBlock content={msg.content} isStreaming={msg.isStreaming} />
                            )}
                        </Box>
                    </Paper>
                </motion.div>
            )
        }

        return null
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
                                ref={scrollContainerRef}
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

                                {!isLoadingServer && activeServer && messages.length === 0 && !showLoadingDots && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, opacity: 0.7 }}>
                                        <IconSparkles size={48} stroke={1} />
                                        <Typography variant="body1" sx={{ mt: 2 }}>
                                            Describe the agent flow you want to build.
                                        </Typography>
                                    </Box>
                                )}

                                {messages.map((msg, index) => renderMessage(msg, index))}

                                {showLoadingDots && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theme.palette.text.secondary, pl: 2, py: 1 }}>
                                        <RunningDots />
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#b9664a' }}>
                                            Thinking...
                                        </Typography>
                                    </Box>
                                )}

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
