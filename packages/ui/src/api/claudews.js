import client from './client'

// ClaudeWS Server Management
const getAllServers = () => client.get('/claudews-servers')

const getServerById = (id) => client.get(`/claudews-servers/${id}`)

const createServer = (data) => client.post('/claudews-servers', data)

const updateServer = (id, data) => client.put(`/claudews-servers/${id}`, data)

const deleteServer = (id) => client.delete(`/claudews-servers/${id}`)

const testConnection = (id) => client.post(`/claudews-servers/${id}/test-connection`)

const testConnectionWithCredentials = (credentials) => client.post('/claudews-servers/test-connection', credentials)

// Plugin Management
const listPlugins = (serverId, type = null) => {
    const params = type ? { type } : {}
    return client.get(`/claudews-servers/${serverId}/plugins`, { params })
}

const getPlugin = (serverId, pluginName) => client.get(`/claudews-servers/${serverId}/plugins/${pluginName}`)

const uploadPlugin = (serverId, data) => {
    // Handle both FormData (file upload) and JSON (confirmation)
    const isFormData = data instanceof FormData
    return client.post(`/claudews-servers/${serverId}/plugins/upload`, data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
    })
}

const discoverPlugins = (serverId, paths) => client.post(`/claudews-servers/${serverId}/plugins/discover`, { paths })

const importPlugin = (serverId, data) => client.post(`/claudews-servers/${serverId}/plugins/import`, data)

const deletePlugin = (serverId, pluginName) => client.delete(`/claudews-servers/${serverId}/plugins/${pluginName}`)

const listPluginFiles = (serverId, pluginId) => client.get(`/claudews-servers/${serverId}/plugins/${pluginId}/files`)

const getPluginFileContent = (serverId, pluginId, filePath) =>
    client.get(`/claudews-servers/${serverId}/plugins/${pluginId}/files/${filePath}`)

const getPluginDependencies = (serverId, pluginId) => client.get(`/claudews-servers/${serverId}/plugins/${pluginId}/dependencies`)

const getFileContent = (serverId, path) => client.post(`/claudews-servers/${serverId}/file-content`, { path })

const getDependenciesFromSource = (serverId, sourcePath, type) =>
    client.post(`/claudews-servers/${serverId}/dependencies-from-source`, { sourcePath, type })

// Skills
const listSkills = (serverId) => client.get(`/claudews-servers/${serverId}/skills`)

const getSkill = (serverId, skillName) => client.get(`/claudews-servers/${serverId}/skills/${skillName}`)

// Agent Sets
const listAgentSets = (serverId) => client.get(`/claudews-servers/${serverId}/agent-sets`)

const getAgentSet = (serverId, agentSetName) => client.get(`/claudews-servers/${serverId}/agent-sets/${agentSetName}`)

export default {
    getAllServers,
    getServerById,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    testConnectionWithCredentials,
    listPlugins,
    getPlugin,
    uploadPlugin,
    discoverPlugins,
    importPlugin,
    deletePlugin,
    listPluginFiles,
    getPluginFileContent,
    getPluginDependencies,
    getFileContent,
    getDependenciesFromSource,
    listSkills,
    getSkill,
    listAgentSets,
    getAgentSet
}
