import PropTypes from 'prop-types'
import { useState, useEffect, useRef, useContext } from 'react'
import { useDispatch } from 'react-redux'
import { Box, TextField, Paper, Typography, IconButton, Fab, useTheme, Tooltip, CircularProgress, alpha } from '@mui/material'

import { io } from 'socket.io-client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { flowContext } from '@/store/context/ReactFlowContext'
import { enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import { nanoid } from 'nanoid'
import claudewsApi from '@/api/claudews'

import nodesApi from '@/api/nodes'
import { inflateFlow, generateTypeMap } from './AgentflowSimplifier'

import useApi from '@/hooks/useApi'
import { AnimatePresence, motion } from 'framer-motion'
import { RunningDots } from './RunningDots'
import { autoLayout } from './layoutUtils'

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
    IconBolt,
    IconCheck,
    IconFolder
} from '@tabler/icons-react'

// ==============================|| SUB-COMPONENTS ||============================== //



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
        code({ inline, className, children, ...props }) {
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
                {typeof content === 'string' ? content : (content ? JSON.stringify(content) : '')}
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {typeof content === 'string' ? content : (content ? JSON.stringify(content) : '')}
                            </ReactMarkdown>
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

const AgentflowGeneratorChat = ({ onFlowGenerated }) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const [open, setOpen] = useState(false)
    const [componentNodes, setComponentNodes] = useState({})
    const [simplifierTypeMap, setSimplifierTypeMap] = useState(null)

    // Fetch component nodes on mount for hydration
    useEffect(() => {
        nodesApi.getAllNodes().then((response) => {
            const nodeMap = {}
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach(node => {
                    nodeMap[node.name] = node
                })
                setComponentNodes(nodeMap)
                // Generate Type Map for Simplifier
                const { typeMap, menuString } = generateTypeMap(nodeMap)
                // console.log('[AgentflowGenerator] Generated Menu:', menuString)
                setSimplifierTypeMap(typeMap)
            }
        }).catch(err => console.error('Failed to fetch nodes:', err))
    }, [])

    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef(null)
    const messagesEndRef = useRef(null)
    const scrollContainerRef = useRef(null)

    const [activeServer, setActiveServer] = useState(null)
    const [currentTaskId, setCurrentTaskId] = useState(null)
    const [isLoadingServer, setIsLoadingServer] = useState(false)
    const userScrollingRef = useRef(false)
    const userScrollTimeoutRef = useRef(null)

    // DEBUG STATE
    const [showDebug, setShowDebug] = useState(false)
    const [debugJson, setDebugJson] = useState('')

    const handleManualRender = () => {
        try {
            console.log('[Debug] Manual Render Triggered')
            let flowData = JSON.parse(debugJson)

            // INFLATION CHECK
            // Check if it's a minified flow (has typeId OR name, but not a full flow with data property details usually)
            // A full flow node usually has 'data' and 'position'. A minified node usually has 'typeId' or just 'name' and 'inputs'.
            const isMinified = flowData.nodes[0].typeId || (flowData.nodes[0].name && !flowData.nodes[0].data)

            if (flowData && flowData.nodes && flowData.nodes.length > 0 && isMinified) {
                console.log('[Debug] Inflating Minified Flow...')
                const inflated = inflateFlow(flowData, simplifierTypeMap, componentNodes)
                // console.log('[Debug] Inflated Result:', inflated)
                console.log(JSON.stringify(inflated, null, 2))
                setDebugJson(JSON.stringify(inflated, null, 2)) // Update UI with inflated JSON
                flowData = inflated
            }

            if (flowData && flowData.nodes && Array.isArray(flowData.nodes) && flowData.nodes.length > 0) {
                if (reactFlowInstance) {
                    const safeNodes = flowData.nodes
                    const processedEdges = (flowData.edges || []).map(edge => ({
                        ...edge,
                        type: 'agentFlow',
                        id: edge.id || `e_${nanoid()}`,
                        data: { ...edge.data, label: edge.data?.label || '' }
                    }))

                    const { nodes: alignedNodes, edges: alignedEdges } = autoLayout(safeNodes, processedEdges, { direction: 'LR' })

                    reactFlowInstance.setNodes(alignedNodes)
                    reactFlowInstance.setEdges(alignedEdges)
                    setTimeout(() => reactFlowInstance.fitView(), 100)
                    enqueueSnackbar({ message: 'Flow Rendered Successfully', options: { variant: 'success' } })
                }
            } else {
                enqueueSnackbar({ message: 'Invalid Flow Data: No nodes found', options: { variant: 'warning' } })
            }
        } catch (e) {
            console.error('[Debug] Render Error:', e)
            enqueueSnackbar({ message: `Render Error: ${e.message}`, options: { variant: 'error' } })
        }
    }


    const getAllServersApi = useApi(claudewsApi.getAllServers)



    const { reactFlowInstance } = useContext(flowContext)

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


    // Fetch Servers and V3 Prompt on Open
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


    // Refactored handleOutputJson (moved out of useEffect for access)
    const handleOutputJson = (payload) => {
        console.log('[DEBUG] handleOutputJson payload:', payload)
        try {
            const { data } = payload
            setMessages((prev) => {
                const newMessages = [...prev]
                const lastMsgIndex = newMessages.length - 1
                const lastMsg = newMessages[lastMsgIndex]

                if (data.type === 'assistant') {
                    if (lastMsg && lastMsg.isStreaming && lastMsg.role === data.message.role) {
                        const prevContent = Array.isArray(lastMsg.content) ? lastMsg.content : (lastMsg.content ? [{ type: 'text', text: lastMsg.content }] : [])
                        const newContent = Array.isArray(data.message.content) ? data.message.content : (data.message.content ? [{ type: 'text', text: data.message.content }] : [])

                        // Check for duplicates based on ID or content to avoid double-adding if backend sends cumulative updates (though debug logs suggest distinct)
                        // For now, simple append seems correct based on logs
                        newMessages[lastMsgIndex] = { ...lastMsg, content: [...prevContent, ...newContent] }
                        return newMessages
                    } else {
                        return [...newMessages, { role: data.message.role, content: data.message.content, id: nanoid(), isStreaming: true }]
                    }
                }

                // Handle 'result'
                if (data.type === 'result') {
                    console.log('[DEBUG] Output Result Received:', data)
                    setIsStreaming(false)
                    let flowData = null


                    if (data.content && typeof data.content === 'object') {
                        // Support both direct flow object or nested in content
                        flowData = data.content.flow || data.content

                        // INFLATION CHECK:
                        // If the flow data has 'typeId' in nodes, it is a simplified flow.
                        // We inflate it before proceeding.
                        if (flowData && flowData.nodes && flowData.nodes.length > 0 && flowData.nodes[0].typeId) {
                            console.log('[AgentflowGenerator] Detected Simplified Flow. Inflating...')
                            console.log(JSON.stringify(flowData, null, 2))
                            const inflated = inflateFlow(flowData, simplifierTypeMap, componentNodes)
                            console.log('[AgentflowGenerator] Inflated Result:', inflated)
                            flowData = inflated
                        }

                        const rawMsg = data.content.message

                        if (rawMsg) {
                            const newText = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg)
                            // Append as new block
                            if (lastMsg && lastMsg.role === 'assistant') {
                                const prevContent = Array.isArray(lastMsg.content) ? lastMsg.content : (lastMsg.content ? [{ type: 'text', text: lastMsg.content }] : [])
                                // Add a newline prefix if user wants separation, though distinct blocks usually suffice. 
                                // User asked for newline explicitly, but separate blocks are better.
                                // Let's ensure it is a separate block.
                                const newBlock = { type: 'text', text: newText }
                                newMessages[lastMsgIndex] = { ...lastMsg, content: [...prevContent, newBlock], isStreaming: false }
                            } else {
                                newMessages.push({ role: 'assistant', content: [{ type: 'text', text: newText }], isStreaming: false, id: nanoid(), timestamp: new Date() })
                            }
                        } else {
                            // Just ensure streaming is off
                            if (lastMsg && lastMsg.role === 'assistant') {
                                newMessages[lastMsgIndex] = { ...lastMsg, isStreaming: false }
                            }
                        }
                    }

                    if (flowData && flowData.nodes && Array.isArray(flowData.nodes) && flowData.nodes.length > 0) {
                        console.log('[DEBUG] Flow Received from Client:', JSON.stringify(flowData, null, 2))

                        if (reactFlowInstance) {
                            const safeNodes = flowData.nodes

                            // 1. Enforce agentFlow type and inject colors if missing
                            const processedEdges = (flowData.edges || []).map(edge => {
                                const sourceNode = safeNodes.find(n => n.id === edge.source)
                                const targetNode = safeNodes.find(n => n.id === edge.target)
                                return {
                                    ...edge,
                                    type: 'agentFlow',
                                    id: edge.id || `e_${nanoid()}`,
                                    data: {
                                        ...edge.data,
                                        label: edge.data?.label || '',
                                        sourceColor: sourceNode?.data?.color || '#333',
                                        targetColor: targetNode?.data?.color || '#333'
                                    }
                                }
                            })

                            const { nodes: alignedNodes, edges: alignedEdges } = autoLayout(safeNodes, processedEdges, { direction: 'LR' })

                            console.log('[DEBUG] Final ReactFlow Data:', { nodes: alignedNodes, edges: alignedEdges })

                            reactFlowInstance.setNodes(alignedNodes)
                            reactFlowInstance.setEdges(alignedEdges)
                            setTimeout(() => reactFlowInstance.fitView(), 100)
                            if (onFlowGenerated) onFlowGenerated()
                        }
                    }
                    return newMessages
                }

                // Handle Content Block Delta (Streaming)
                if (data.type === 'content_block_delta') {
                    if (!lastMsg || lastMsg.role !== 'assistant') {
                        return [...newMessages, {
                            role: 'assistant',
                            content: [],
                            isStreaming: true,
                            id: nanoid(),
                            timestamp: new Date()
                        }]
                    }

                    let targetMsg = lastMsg

                    if (Array.isArray(targetMsg.content)) {
                        const newContent = [...targetMsg.content]
                        const blockIndex = data.index

                        if (!newContent[blockIndex]) {
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
                        }
                        newMessages[lastMsgIndex] = { ...targetMsg, content: newContent }
                        return newMessages
                    }
                }

                return newMessages
            })
        } catch (error) {
            console.error('Error handling output json:', error)
        }
    }

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


            socket.on('output:json', handleOutputJson)

            // Listen for attempting started to confirm task creation
            socket.on('attempt:started', (data) => {
                console.log('Attempt started:', data)
                setIsStreaming(true)
            })

            // Listen for attempt finished (Safety net to ensure loading stops)
            socket.on('attempt:finished', (data) => {
                console.log('Attempt finished:', data)
                setIsStreaming(false)
            })

            // Listen for any output/response
            socket.on('output:stderr', (data) => {
                console.log('Stderr:', data)
                // Also stop streaming on error
                setIsStreaming(false) // Safety unlock on error
            })


        }


        return () => {
        }
    }, [open, activeServer, simplifierTypeMap])

    const addMessage = (role, content) => {
        setMessages((prev) => [...prev, { role, content, id: nanoid(), timestamp: new Date() }])
    }

    const handleSendMessage = () => {
        if (!input.trim()) return

        const userMessage = input.trim()
        addMessage('user', userMessage)
        setInput('')
        setIsStreaming(true)



        // Emit attempt:start to trigger the agent
        let taskId = currentTaskId
        let forceCreate = !currentTaskId

        if (!taskId) {
            taskId = nanoid()
            setCurrentTaskId(taskId)
            forceCreate = true
        }

        // Define the required output structure
        const jsonStructure = {
            flow: "Object. The agent flow JSON with 'nodes' and 'edges' arrays. Null if no flow generated."
        }

        // Format instructions (System Prompt is handled by Skill)
        const combinedSchema = `${JSON.stringify(jsonStructure, null, 2)}`



        // Create explicit instructions for the simplified schema
        const payload = {
            taskId: taskId,
            prompt: `/flow ${userMessage}`,
            // We still use 'custom' but we rely on the prompt to enforce the schema for now
            outputFormat: 'custom',
            outputSchema: combinedSchema,
            force_create: forceCreate,
            projectId: 'flowise-generator-project',
            projectName: 'Flowise Generator',
            taskTitle: `Generate Flow: ${String(userMessage).substring(0, 20)}...`,
            context: {
                isAgentFlowGenerator: true
            }
        }

        console.log('[AgentflowGeneratorChat] Sending Payload:', payload)

        if (socketRef.current) {
            socketRef.current.emit('attempt:start', payload)
        } else {
            console.error('[AgentflowGeneratorChat] Socket not connected!')
            setIsStreaming(false)
        }



    }






    // Check if the LATEST message has visible content
    const hasVisibleContent = (msgs) => {
        if (!msgs || msgs.length === 0) return false
        const lastMsg = msgs[msgs.length - 1]

        if (lastMsg.role === 'assistant') {
            if (Array.isArray(lastMsg.content) && lastMsg.content.length > 0) {
                return lastMsg.content.some(block =>
                    (block.type === 'text' && block.text) ||
                    (block.type === 'thinking' && block.thinking) ||
                    block.type === 'tool_use'
                )
            }
            if (typeof lastMsg.content === 'string' && lastMsg.content.trim()) {
                return true
            }
        }
        return false
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
            // Clean up display text related to schema instructions if present
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
        <>
            {/* DEBUG FAB - Bottom Left */}
            <Box sx={{ position: 'fixed', bottom: 30, left: 30, zIndex: theme.zIndex.appBar + 1 }}>
                <Tooltip title="Debug Flow" placement="right">
                    <Fab
                        size="medium"
                        color="secondary"
                        aria-label="debug"
                        onClick={() => {
                            setOpen(true)
                            setShowDebug(true)
                        }}
                        sx={{
                            background: 'linear-gradient(45deg, #FF6B6B 30%, #FF8E53 90%)',
                        }}
                    >
                        <IconSparkles size={24} />
                    </Fab>
                </Tooltip>
            </Box>

            {/* MAIN CHAT FAB - Bottom Right (Original Position) */}
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
                                        {/* DEBUG BUTTON - HIDDEN IN HEADER (Moved to FAB) */}
                                        {/* 
                                        {process.env.NODE_ENV !== 'production' && (
                                            <Tooltip title="Debug: Manual Render">
                                                <IconButton size="small" onClick={() => setShowDebug(!showDebug)} sx={{ color: 'white', '&:hover': { bgcolor: alpha('#fff', 0.1) } }}>
                                                    <IconSparkles size={18} />
                                                </IconButton>
                                            </Tooltip>
                                        )} 
                                        */}

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
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                                                    borderRadius: 2,
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
                                                flexShrink: 0,
                                                mb: 0.5, // Align with text field bottom
                                                '&:hover': {
                                                    bgcolor: theme.palette.primary.dark
                                                }
                                            }}
                                        >
                                            <IconSend size={20} />
                                        </IconButton>
                                    </Box>
                                </Box>
                                {/* DEBUG OVERLAY */}
                                {showDebug && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 60,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            bgcolor: 'background.paper',
                                            zIndex: 20,
                                            p: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 2
                                        }}
                                    >
                                        <Typography variant="h6">Debug Flow Renderer</Typography>
                                        <TextField
                                            multiline
                                            rows={15}
                                            fullWidth
                                            placeholder="Paste Miniflow or Full Flow JSON here..."
                                            value={debugJson}
                                            onChange={(e) => setDebugJson(e.target.value)}
                                            sx={{ fontFamily: 'monospace' }}
                                        />
                                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                            <IconButton onClick={() => setShowDebug(false)} color="error">
                                                <IconX />
                                            </IconButton>
                                            <Fab
                                                variant="extended"
                                                size="medium"
                                                color="primary"
                                                onClick={handleManualRender}
                                            >
                                                <IconPlugConnected size={20} style={{ marginRight: 8 }} />
                                                Render Flow
                                            </Fab>
                                        </Box>
                                    </Box>
                                )}
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

                {/* DEBUG FAB (Removed from here, moved to separate container) */}
            </Box>
        </>
    )
}

export default AgentflowGeneratorChat

