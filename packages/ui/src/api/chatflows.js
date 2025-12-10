import client from './client'

const getAllChatflows = (params) => client.get('/chatflows?type=CHATFLOW', { params })

const getAllAgentflows = (type, params) => client.get(`/chatflows?type=${type}`, { params })

const getSpecificChatflow = (id) => client.get(`/chatflows/${id}`)

const getSpecificChatflowFromPublicEndpoint = (id) => client.get(`/public-chatflows/${id}`)

const createNewChatflow = (body) => client.post(`/chatflows`, body)

const updateChatflow = (id, body) => client.put(`/chatflows/${id}`, body)

const deleteChatflow = (id) => client.delete(`/chatflows/${id}`)

const getIsChatflowStreaming = (id) => client.get(`/chatflows-streaming/${id}`)

const getAllowChatflowUploads = (id) => client.get(`/chatflows-uploads/${id}`)

const getHasChatflowChanged = (id, lastUpdatedDateTime) => client.get(`/chatflows/has-changed/${id}/${lastUpdatedDateTime}`)

const generateAgentflow = (body) => client.post(`/agentflowv2-generator/generate`, body)

// Schedule Management
const getScheduleConfig = (id) => client.get(`/chatflows/schedule/${id}`)

const updateScheduleConfig = (id, body) => client.post(`/chatflows/schedule/${id}`, body)

const enableSchedule = (id) => client.post(`/chatflows/schedule/${id}/enable`)

const disableSchedule = (id) => client.post(`/chatflows/schedule/${id}/disable`)

const getAllScheduledChatflows = () => client.get(`/chatflows/schedules/all`)

// Bot Management
const updateBotEnabled = (id, enabled) => client.post(`/chatflows/bot/${id}`, { enabled })

const getAllBots = () => client.get(`/chatflows/bots/all`)

// SubAgent Management
const updateSubAgentEnabled = (id, enabled) => client.post(`/chatflows/subagent/${id}`, { enabled })

const getAllSubAgents = () => client.get(`/chatflows/subagents/all`)

export default {
    getAllChatflows,
    getAllAgentflows,
    getSpecificChatflow,
    getSpecificChatflowFromPublicEndpoint,
    createNewChatflow,
    updateChatflow,
    deleteChatflow,
    getIsChatflowStreaming,
    getAllowChatflowUploads,
    getHasChatflowChanged,
    generateAgentflow,
    getScheduleConfig,
    updateScheduleConfig,
    enableSchedule,
    disableSchedule,
    getAllScheduledChatflows,
    updateBotEnabled,
    getAllBots,
    updateSubAgentEnabled,
    getAllSubAgents
}
