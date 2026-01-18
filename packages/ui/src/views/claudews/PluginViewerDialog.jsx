import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Tabs,
    Tab,
    Box,
    Typography,
    Chip,
    IconButton,
    Divider,
    Paper,
    CircularProgress,
    Button,
    Alert
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
    IconX,
    IconFolder,
    IconFile,
    IconCode,
    IconPackage,
    IconChevronRight,
    IconChevronDown,
    IconRefresh,
    IconCopy,
    IconCalendar,
    IconDatabase
} from '@tabler/icons-react'
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github-dark.css'

// Import common languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)

import claudewsApi from '@/api/claudews'
import client from '@/api/client'

const PluginViewerDialog = ({ show, plugin, server, onClose, setError }) => {
    const theme = useTheme()
    const codeRef = useRef(null)
    const [currentTab, setCurrentTab] = useState(0)
    const [files, setFiles] = useState([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)
    const [fileContent, setFileContent] = useState(null)
    const [loadingContent, setLoadingContent] = useState(false)
    const [expandedDirs, setExpandedDirs] = useState(new Set())
    const [dependencies, setDependencies] = useState(null)
    const [loadingDeps, setLoadingDeps] = useState(false)
    const [showFileModal, setShowFileModal] = useState(false)

    // Reset state when plugin changes
    useEffect(() => {
        if (show && plugin) {
            setCurrentTab(0)
            setFiles([])
            setSelectedFile(null)
            setFileContent(null)
            setDependencies(null)
            setExpandedDirs(new Set())
        }
    }, [show, plugin])

    // Load files when Files tab is selected
    useEffect(() => {
        if (show && currentTab === 1 && files.length === 0 && plugin && server) {
            if (plugin.storageType === 'discovered') {
                loadDiscoveredPluginFiles()
            } else {
                loadFiles()
            }
        }
    }, [show, currentTab, plugin, server])

    // Load dependencies when Dependencies tab is selected
    useEffect(() => {
        if (show && currentTab === 2 && !dependencies && plugin && server) {
            // Skip loading for discovered plugins - they use sourcePath
            if (plugin.storageType === 'discovered') {
                loadDiscoveredPluginDependencies()
            } else {
                loadDependencies()
            }
        }
    }, [show, currentTab, plugin, server])

    // Apply syntax highlighting when file content changes
    useEffect(() => {
        if (fileContent && codeRef.current) {
            hljs.highlightElement(codeRef.current)
        }
    }, [fileContent])

    const loadFiles = async () => {
        setLoadingFiles(true)
        try {
            console.log('[PluginViewer] Loading files for plugin:', plugin.id, plugin.name)
            console.log('[PluginViewer] Server ID:', server.id)
            const response = await claudewsApi.listPluginFiles(server.id, plugin.id || plugin.name)
            console.log('[PluginViewer] Files response:', response)
            // Handle both wrapped response ({data: {files: [...]}}) and direct array response
            const filesData = response.data?.files || response.data || response || []
            console.log('[PluginViewer] Files data:', filesData)
            setFiles(Array.isArray(filesData) ? filesData : [])
        } catch (error) {
            console.error('[PluginViewer] Error loading files:', error)
            // Only call setError if it exists and with a safe error object
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load plugin files',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingFiles(false)
        }
    }

    const loadFileContent = async (filePath) => {
        setLoadingContent(true)
        setShowFileModal(true) // Open modal immediately
        setFileContent(null) // Clear previous content
        try {
            console.log('[PluginViewer] Loading file content:', filePath)

            if (plugin.storageType === 'discovered') {
                // For discovered plugins, construct full path from sourcePath
                const fullPath = filePath.startsWith('/') ? filePath : `${plugin.sourcePath}/${filePath}`
                const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/')
                const response = await client.post(`/claudews-servers/${server.id}/file-content`, { path: fullPath })
                setFileContent(response.data || response)
            } else {
                // For imported plugins, use the existing API
                const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
                const response = await claudewsApi.getPluginFileContent(server.id, plugin.id || plugin.name, encodedPath)
                setFileContent(response.data || response)
            }
        } catch (error) {
            console.error('[PluginViewer] Error loading file content:', error)
            setShowFileModal(false) // Close modal on error
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load file content',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingContent(false)
        }
    }

    const loadDependencies = async () => {
        setLoadingDeps(true)
        try {
            console.log('[PluginViewer] Loading dependencies for plugin:', plugin.id, plugin.name)
            const response = await claudewsApi.getPluginDependencies(server.id, plugin.id || plugin.name)
            console.log('[PluginViewer] Dependencies response:', response)
            // Handle both wrapped and direct response
            setDependencies(response.data || response)
        } catch (error) {
            console.error('[PluginViewer] Error loading dependencies:', error)
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load dependencies',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingDeps(false)
        }
    }

    const loadDiscoveredPluginFile = async () => {
        setLoadingContent(true)
        try {
            // Determine the main file path based on plugin type
            let filePath = plugin.sourcePath

            // For skills, the main file is SKILL.md in the directory
            if (plugin.type === 'skill') {
                filePath = plugin.sourcePath.endsWith('/') ? `${plugin.sourcePath}SKILL.md` : `${plugin.sourcePath}/SKILL.md`
            }
            // For commands and agents, sourcePath is the file itself
            // For agent-sets, we'll try to read from the directory

            console.log('[PluginViewer] Loading discovered plugin file from:', filePath)

            const response = await claudewsApi.getFileContent(server.id, filePath)
            console.log('[PluginViewer] File content response:', response)

            // Handle response - extract content
            const content = response.data?.content || response.content || response.data || response
            setFileContent({ name: filePath.split('/').pop(), content })
        } catch (error) {
            console.error('[PluginViewer] Error loading discovered plugin file:', error)
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load file from source path',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingContent(false)
        }
    }

    const loadDiscoveredPluginDependencies = async () => {
        setLoadingDeps(true)
        try {
            console.log('[PluginViewer] Loading discovered plugin dependencies from:', plugin.sourcePath)

            // Use client directly to bypass the missing API function
            const response = await client.post(`/claudews-servers/${server.id}/dependencies-from-source`, {
                sourcePath: plugin.sourcePath,
                type: plugin.type
            })
            console.log('[PluginViewer] Dependencies response:', response)

            // Handle response
            setDependencies(response.data || response)
        } catch (error) {
            console.error('[PluginViewer] Error loading discovered plugin dependencies:', error)
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load dependencies from source path',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingDeps(false)
        }
    }

    const loadDiscoveredPluginFiles = async () => {
        setLoadingFiles(true)
        try {
            console.log('[PluginViewer] Loading discovered plugin files from:', plugin.sourcePath)

            const response = await client.post(`/claudews-servers/${server.id}/files-from-source`, {
                sourcePath: plugin.sourcePath
            })
            console.log('[PluginViewer] Files response:', response)

            // Handle response - convert to file tree format
            const filesData = response.data?.files || response.data || response || []
            setFiles(Array.isArray(filesData) ? filesData : [])
        } catch (error) {
            console.error('[PluginViewer] Error loading discovered plugin files:', error)
            if (setError && typeof setError === 'function') {
                setError({
                    message: error?.message || 'Failed to load files from source path',
                    response: error?.response,
                    status: error?.response?.status
                })
            }
        } finally {
            setLoadingFiles(false)
        }
    }

    const toggleDir = (path) => {
        setExpandedDirs((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(path)) {
                newSet.delete(path)
            } else {
                newSet.add(path)
            }
            return newSet
        })
    }

    const handleFileClick = (node) => {
        if (node.type === 'directory') {
            toggleDir(node.path)
        } else {
            setSelectedFile(node.path)
            loadFileContent(node.path)
        }
    }

    const renderFileTree = (nodes, level = 0) => {
        return nodes.map((node) => (
            <Box key={node.path}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                        px: 1,
                        pl: level * 2 + 1,
                        cursor: 'pointer',
                        bgcolor: selectedFile === node.path ? theme.palette.action.selected : 'transparent',
                        '&:hover': {
                            bgcolor: theme.palette.action.hover
                        },
                        borderRadius: 1
                    }}
                    onClick={() => handleFileClick(node)}
                >
                    {node.type === 'directory' ? (
                        <>
                            {expandedDirs.has(node.path) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            <IconFolder size={18} color={theme.palette.primary.main} />
                        </>
                    ) : (
                        <>
                            <Box sx={{ width: 16 }} />
                            <IconFile size={18} color={theme.palette.text.secondary} />
                        </>
                    )}
                    <Typography variant='body2' sx={{ fontSize: '0.875rem' }}>
                        {node.name}
                    </Typography>
                </Box>
                {node.type === 'directory' && expandedDirs.has(node.path) && node.children && renderFileTree(node.children, level + 1)}
            </Box>
        ))
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'skill':
                return 'primary'
            case 'agent':
                return 'success'
            case 'command':
                return 'warning'
            case 'agent-set':
                return 'info'
            default:
                return 'default'
        }
    }

    const getLanguageFromFilename = (filename) => {
        const ext = filename.split('.').pop()?.toLowerCase()
        const langMap = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            py: 'python',
            sh: 'bash',
            bash: 'bash',
            json: 'json',
            yml: 'yaml',
            yaml: 'yaml',
            md: 'markdown'
        }
        return langMap[ext] || 'plaintext'
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
    }

    if (!plugin) return null

    return (
        <>
            <Dialog open={show} onClose={onClose} maxWidth='md' fullWidth PaperProps={{ sx: { height: '80vh' } }}>
                <DialogTitle sx={{ pb: 1 }}>
                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                        <Box display='flex' alignItems='center' gap={2}>
                            <IconPackage size={24} />
                            <Box>
                                <Typography variant='h6'>{plugin.name}</Typography>
                                <Chip label={plugin.type} size='small' color={getTypeColor(plugin.type)} sx={{ mt: 0.5 }} />
                            </Box>
                        </Box>
                        <IconButton onClick={onClose} size='small'>
                            <IconX />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                        <Tab label='Details' />
                        <Tab label='Files' />
                        <Tab label='Dependencies' />
                    </Tabs>

                    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                        {/* Details Tab */}
                        {currentTab === 0 && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {plugin.description && (
                                    <Box>
                                        <Typography variant='subtitle2' color='text.secondary' gutterBottom>
                                            Description
                                        </Typography>
                                        <Typography variant='body2'>{plugin.description}</Typography>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant='subtitle2' color='text.secondary' gutterBottom>
                                        Source Path
                                    </Typography>
                                    <Paper variant='outlined' sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                        <Typography
                                            variant='body2'
                                            sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}
                                        >
                                            {plugin.sourcePath}
                                        </Typography>
                                    </Paper>
                                </Box>

                                {plugin.storageType && (
                                    <Box>
                                        <Box display='flex' alignItems='center' gap={1} mb={1}>
                                            <IconDatabase size={16} color={theme.palette.text.secondary} />
                                            <Typography variant='subtitle2' color='text.secondary'>
                                                Storage
                                            </Typography>
                                        </Box>
                                        <Chip label={plugin.storageType} size='small' variant='outlined' />
                                    </Box>
                                )}

                                {plugin.metadata && (
                                    <Box>
                                        <Typography variant='subtitle2' color='text.secondary' gutterBottom>
                                            Metadata
                                        </Typography>
                                        <Paper variant='outlined' sx={{ p: 2, bgcolor: theme.palette.background.default }}>
                                            <pre
                                                style={{
                                                    margin: 0,
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.75rem',
                                                    overflow: 'auto'
                                                }}
                                            >
                                                {typeof plugin.metadata === 'string'
                                                    ? JSON.stringify(JSON.parse(plugin.metadata), null, 2)
                                                    : JSON.stringify(plugin.metadata, null, 2)}
                                            </pre>
                                        </Paper>
                                    </Box>
                                )}

                                {(plugin.createdAt || plugin.updatedAt) && (
                                    <Box>
                                        <Box display='flex' alignItems='center' gap={1} mb={1}>
                                            <IconCalendar size={16} color={theme.palette.text.secondary} />
                                            <Typography variant='subtitle2' color='text.secondary'>
                                                Timestamps
                                            </Typography>
                                        </Box>
                                        <Box display='flex' flexDirection='column' gap={0.5}>
                                            {plugin.createdAt && (
                                                <Typography variant='body2' color='text.secondary' sx={{ fontSize: '0.875rem' }}>
                                                    Created: {new Date(plugin.createdAt).toLocaleString()}
                                                </Typography>
                                            )}
                                            {plugin.updatedAt && (
                                                <Typography variant='body2' color='text.secondary' sx={{ fontSize: '0.875rem' }}>
                                                    Updated: {new Date(plugin.updatedAt).toLocaleString()}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Files Tab */}
                        {currentTab === 1 && (
                            <Box>
                                {loadingFiles ? (
                                    <Box display='flex' justifyContent='center' py={4}>
                                        <CircularProgress size={24} />
                                    </Box>
                                ) : files.length === 0 ? (
                                    <Alert severity='info'>No files found</Alert>
                                ) : (
                                    <Paper variant='outlined' sx={{ overflow: 'hidden' }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                borderBottom: 1,
                                                borderColor: 'divider',
                                                bgcolor: theme.palette.action.hover
                                            }}
                                        >
                                            <Typography variant='subtitle2'>File Tree</Typography>
                                        </Box>
                                        <Box sx={{ p: 1, maxHeight: 500, overflow: 'auto' }}>{renderFileTree(files)}</Box>
                                    </Paper>
                                )}
                            </Box>
                        )}

                        {/* Dependencies Tab */}
                        {currentTab === 2 && (
                            <Box>
                                {loadingDeps ? (
                                    <Box display='flex' justifyContent='center' py={4}>
                                        <CircularProgress size={24} />
                                    </Box>
                                ) : !dependencies ? (
                                    <Alert severity='info'>No dependencies found</Alert>
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {/* Library Dependencies */}
                                        <Box>
                                            <Box display='flex' alignItems='center' gap={1} mb={2}>
                                                <IconPackage size={18} />
                                                <Typography variant='subtitle2'>Library Dependencies</Typography>
                                                <Chip label={dependencies.libraries?.length || 0} size='small' />
                                            </Box>
                                            {!dependencies.libraries || dependencies.libraries.length === 0 ? (
                                                <Typography variant='body2' color='text.secondary'>
                                                    No external libraries found
                                                </Typography>
                                            ) : (
                                                <Box display='flex' flexWrap='wrap' gap={1}>
                                                    {dependencies.libraries.map((lib, idx) => (
                                                        <Chip
                                                            key={idx}
                                                            label={`${lib.name}${lib.version ? `@${lib.version}` : ''} (${lib.manager})`}
                                                            size='small'
                                                            variant='outlined'
                                                            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>

                                        {/* Plugin Dependencies */}
                                        <Box>
                                            <Box display='flex' alignItems='center' gap={1} mb={2}>
                                                <IconCode size={18} />
                                                <Typography variant='subtitle2'>Plugin Dependencies</Typography>
                                                <Chip label={dependencies.plugins?.length || 0} size='small' />
                                            </Box>
                                            {!dependencies.plugins || dependencies.plugins.length === 0 ? (
                                                <Typography variant='body2' color='text.secondary'>
                                                    No plugin dependencies found
                                                </Typography>
                                            ) : (
                                                <Box display='flex' flexDirection='column' gap={1}>
                                                    {dependencies.plugins.map((plug, idx) => (
                                                        <Box key={idx} display='flex' alignItems='center' gap={1}>
                                                            <Chip label={plug.type} size='small' color={getTypeColor(plug.type)} />
                                                            <Typography variant='body2'>{plug.name}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* File Content Modal */}
            <Dialog
                open={showFileModal}
                onClose={() => setShowFileModal(false)}
                maxWidth='md'
                fullWidth
                PaperProps={{ sx: { height: '80vh' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                        <Box display='flex' alignItems='center' gap={1}>
                            <IconFile size={20} />
                            <Typography variant='h6' sx={{ fontSize: '1rem' }}>
                                {loadingContent ? 'Loading...' : fileContent?.name || 'File'}
                            </Typography>
                        </Box>
                        <Box display='flex' gap={1}>
                            {!loadingContent && fileContent && (
                                <IconButton
                                    size='small'
                                    onClick={() => copyToClipboard(fileContent?.content || '')}
                                    title='Copy to clipboard'
                                >
                                    <IconCopy size={18} />
                                </IconButton>
                            )}
                            <IconButton size='small' onClick={() => setShowFileModal(false)}>
                                <IconX size={18} />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0, bgcolor: '#0d1117', overflow: 'auto' }}>
                    {loadingContent ? (
                        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' height='100%' gap={2}>
                            <CircularProgress size={32} sx={{ color: '#fff' }} />
                            <Typography variant='body2' sx={{ color: '#8b949e' }}>
                                Loading file content...
                            </Typography>
                        </Box>
                    ) : fileContent ? (
                        <pre style={{ margin: 0, padding: '16px', fontSize: '0.875rem' }}>
                            <code
                                ref={codeRef}
                                className={`hljs language-${getLanguageFromFilename(fileContent.name)}`}
                                style={{ display: 'block', overflowX: 'auto' }}
                            >
                                {fileContent.content}
                            </code>
                        </pre>
                    ) : null}
                </DialogContent>

                {fileContent && !loadingContent && (
                    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: theme.palette.background.paper }}>
                        <Box display='flex' justifyContent='space-between'>
                            <Typography variant='caption' color='text.secondary'>
                                {getLanguageFromFilename(fileContent.name)}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                                {(fileContent.size / 1024).toFixed(1)} KB
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Dialog>
        </>
    )
}

PluginViewerDialog.propTypes = {
    show: PropTypes.bool.isRequired,
    plugin: PropTypes.object,
    server: PropTypes.object,
    onClose: PropTypes.func.isRequired,
    setError: PropTypes.func.isRequired
}

export default PluginViewerDialog
