import client from './client'

const getAllFolders = (params) => client.get('/agentflow-folders', { params })

const createFolder = (body) => client.post('/agentflow-folders', body)

const updateFolder = (id, body) => client.put(`/agentflow-folders/${id}`, body)

const deleteFolder = (id) => client.delete(`/agentflow-folders/${id}`)

const moveChatflowToFolder = (chatflowId, body) => client.put(`/chatflows/${chatflowId}/folder`, body)

export default {
    getAllFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    moveChatflowToFolder
}
