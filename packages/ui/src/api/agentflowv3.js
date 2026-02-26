import client from './client'

const getV3Prompt = () => client.get('/agentflowv3-generator/prompt')

const generateAgentflowv3 = (body) => client.post('/agentflowv2-generator/generate', body)

export default {
    getV3Prompt,
    generateAgentflowv3
}
