import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import path from 'path'
import * as fs from 'fs'
import { generateAgentflowv3 as generateAgentflowv3_json } from 'flowise-components'
import { z } from 'zod'
import { databaseEntities } from '../../utils'
import logger from '../../utils/logger'
import { MODE } from '../../Interface'

// ============================================================================
// ZOD SCHEMA FOR VALIDATION (Matches actual agent flow structure)
// ============================================================================

const NodePositionType = z.object({
    x: z.number(),
    y: z.number()
})

const NodeType = z.object({
    id: z.string(),
    type: z.string(),
    position: NodePositionType,
    width: z.number(),
    height: z.number(),
    selected: z.boolean().optional(),
    positionAbsolute: NodePositionType.optional(),
    dragging: z.boolean().optional(),
    data: z.any().optional(),
    parentNode: z.string().optional()
})

const EdgeType = z.object({
    source: z.string(),
    sourceHandle: z.string(),
    target: z.string(),
    targetHandle: z.string(),
    data: z
        .object({
            sourceColor: z.string().optional(),
            targetColor: z.string().optional(),
            edgeLabel: z.string().optional(),
            isHumanInput: z.boolean().optional()
        })
        .optional(),
    type: z.string().optional(),
    id: z.string()
})

const AgentFlowV3Type = z
    .object({
        description: z.string().optional(),
        usecases: z.array(z.string()).optional(),
        nodes: z.array(NodeType),
        edges: z.array(EdgeType)
    })
    .describe('Generate Agentflowv3 nodes and edges')

// ============================================================================
// HELPER FUNCTIONS TO GET AVAILABLE NODES
// ============================================================================

const getAllAgentFlowNodes = async () => {
    const appServer = getRunningExpressApp()
    const nodes = appServer.nodesPool.componentNodes
    const agentFlowNodes = []
    for (const node in nodes) {
        if (nodes[node].category === 'Agent Flows') {
            agentFlowNodes.push({
                name: nodes[node].name,
                label: nodes[node].label,
                description: nodes[node].description
            })
        }
    }
    return JSON.stringify(agentFlowNodes, null, 2)
}

const getAllToolNodes = async () => {
    const appServer = getRunningExpressApp()
    const nodes = appServer.nodesPool.componentNodes
    const toolNodes = []
    const disabled_nodes = process.env.DISABLED_NODES ? process.env.DISABLED_NODES.split(',') : []
    const removeTools = ['chainTool', 'retrieverTool', 'webBrowser', ...disabled_nodes]

    for (const node in nodes) {
        if (nodes[node].category.includes('Tools')) {
            if (removeTools.includes(nodes[node].name)) {
                continue
            }
            toolNodes.push({
                name: nodes[node].name,
                description: nodes[node].description
            })
        }
    }
    return JSON.stringify(toolNodes, null, 2)
}

const getAllAgentflowMarketplaces = async () => {
    const templates: any[] = []
    let marketplaceDir = path.join(__dirname, '..', '..', '..', 'marketplaces', 'agentflowsv2')
    let jsonsInDir = fs.readdirSync(marketplaceDir).filter((file) => path.extname(file) === '.json')

    jsonsInDir.forEach((file) => {
        try {
            const filePath = path.join(__dirname, '..', '..', '..', 'marketplaces', 'agentflowsv2', file)
            const fileData = fs.readFileSync(filePath)
            const fileDataObj = JSON.parse(fileData.toString())

            // Simplify nodes for examples (remove full data, keep structure)
            const simplifiedNodes = fileDataObj.nodes.map((node: any) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                width: node.width,
                height: node.height,
                data: {
                    name: node.data?.name,
                    label: node.data?.label
                }
            }))

            const title = file.split('.json')[0]
            templates.push({
                title,
                description: fileDataObj.description || `Template from ${file}`,
                nodes: simplifiedNodes,
                edges: fileDataObj.edges
            })
        } catch (error) {
            console.error(`Error processing template file ${file}:`, error)
        }
    })

    // Format templates as examples for LLM
    let formattedTemplates = 'WORKFLOW EXAMPLES:\n\n'
    templates.forEach((template, index) => {
        formattedTemplates += `Example ${index + 1}: ${template.title}\n`
        formattedTemplates += `Description: ${template.description}\n\n`
        formattedTemplates += 'Nodes:\n' + JSON.stringify(template.nodes, null, 2) + '\n\n'
        formattedTemplates += 'Edges:\n' + JSON.stringify(template.edges, null, 2) + '\n\n---\n\n'
    })

    return formattedTemplates
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

const generateAgentflowv3 = async (question: string, selectedChatModel: Record<string, any>) => {
    try {
        logger.info('[generateAgentflowv3] Starting workflow generation')
        logger.info('[generateAgentflowv3] Question:', question)

        // Get available nodes and examples
        const agentFlowNodes = await getAllAgentFlowNodes()
        const toolNodes = await getAllToolNodes()
        const marketplaceExamples = await getAllAgentflowMarketplaces()

        // Build enhanced prompt
        const prompt = buildSystemPrompt(agentFlowNodes, toolNodes, marketplaceExamples)

        const options: Record<string, any> = {
            appDataSource: getRunningExpressApp().AppDataSource,
            databaseEntities: databaseEntities,
            logger: logger
        }

        let response

        // Use queue if in queue mode
        if (process.env.MODE === MODE.QUEUE) {
            const predictionQueue = getRunningExpressApp().queueManager.getQueue('prediction')
            const job = await predictionQueue.addJob({
                prompt,
                question,
                toolNodes,
                selectedChatModel,
                isAgentFlowGenerator: true
            })
            logger.debug(`[server]: Generated Agentflowv3 Job added to queue: ${job.id}`)
            const queueEvents = predictionQueue.getQueueEvents()
            response = await job.waitUntilFinished(queueEvents)
        } else {
            // Direct call to generator
            response = await generateAgentflowv3_json(
                { prompt, componentNodes: getRunningExpressApp().nodesPool.componentNodes, toolNodes, selectedChatModel },
                question,
                options
            )
        }

        // Validate response
        try {
            if (typeof response === 'string') {
                const parsedResponse = JSON.parse(response)
                const validatedResponse = AgentFlowV3Type.parse(parsedResponse)
                logger.info('[generateAgentflowv3] Successfully generated and validated workflow')
                return validatedResponse
            } else if (typeof response === 'object') {
                // Check for error in response
                if ('error' in response) {
                    logger.error('[generateAgentflowv3] Error in response:', (response as any).error)
                    throw new Error((response as any).error)
                }
                const validatedResponse = AgentFlowV3Type.parse(response)
                logger.info('[generateAgentflowv3] Successfully generated and validated workflow')
                return validatedResponse
            } else {
                throw new Error(`Unexpected response type: ${typeof response}`)
            }
        } catch (parseError) {
            logger.error('[generateAgentflowv3] Failed to validate response:', parseError)
            return {
                error: 'Failed to validate response format',
                rawResponse: response
            } as any
        }
    } catch (error) {
        logger.error('[generateAgentflowv3] Error:', error)
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: generateAgentflowv3 - ${getErrorMessage(error)}`)
    }
}

// ============================================================================
// ENHANCED SYSTEM PROMPT BUILDER
// ============================================================================

const buildSystemPrompt = (agentFlowNodes: string, toolNodes: string, marketplaceExamples: string) => {
    return `You are an expert workflow orchestrator for Flowise. Your task is to generate valid JSON workflows with nodes and edges based on user requirements.

AVAILABLE NODE TYPES:
${agentFlowNodes}

AVAILABLE TOOLS:
${toolNodes}

${marketplaceExamples}

CRITICAL REQUIREMENTS FOR GENERATION:

1. NODE STRUCTURE - Every node must include:
   - id: Unique identifier (pattern: nodeName_0, nodeName_1, etc.)
   - type: Always "agentFlow" (except iteration nodes use "iteration")
   - position: Object with x and y coordinates
   - width: Number between 100-300
   - height: Number between 60-100
   - data: Object containing at least "name" and "label"

2. EDGE STRUCTURE - Every edge must include:
   - source: ID of source node (must exist in nodes array)
   - sourceHandle: Format "{sourceNodeId}-output-{sourceNodeName}"
   - target: ID of target node (must exist in nodes array)
   - targetHandle: Simply "{targetNodeId}"

3. MANDATORY RULES:
   - First node MUST be "startAgentflow" (id: "startAgentflow_0")
   - All edge.source and edge.target must reference valid node IDs
   - Node IDs must be unique across the entire workflow
   - Position nodes logically (increment x by 300-400 for sequential flow)

4. HANDLE NAMING CONVENTIONS:
   - Standard output: "{nodeId}-output-{nodeName}"
   - Condition node outputs: "{nodeId}-output-0" and "{nodeId}-output-1"
   - Target handles: Always just "{targetNodeId}"

5. POSITIONING GUIDE:
   - Start: x=0, y=0
   - Second node: x=350, y=0
   - Third node: x=700, y=0
   - For branches: increment y by 120 for each branch

NODE USAGE GUIDE:
- startAgentflow: REQUIRED - Always the first node
- llmAgentflow: For text generation, analysis, summarization
- agentAgentflow: For autonomous multi-step tasks with tools
- toolAgentflow: For single tool execution
- conditionAgentflow: For if/else branching logic
- httpAgentflow: For API calls and webhooks
- humanInputAgentflow: For human review/intervention
- loopAgentflow: For iterative workflows

RETURN ONLY VALID JSON. No markdown, no code blocks, no explanation text.`
}

export default {
    generateAgentflowv3
}
