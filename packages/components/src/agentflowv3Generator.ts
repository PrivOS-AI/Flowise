import { ICommonObject } from './Interface'
import { z } from 'zod'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { isEqual, get, cloneDeep } from 'lodash'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { jsonrepair } from 'jsonrepair'

// ============================================================================
// ZOD SCHEMAS - Based on actual agent flow structure
// ============================================================================

const ToolType = z.array(z.string()).describe('List of tools')

// Node Position schema
const NodePositionType = z.object({
    x: z.number().describe('X coordinate of the node position'),
    y: z.number().describe('Y coordinate of the node position')
})

// LLM Message schema for llmAgentflow nodes
const LLMMessageType = z.object({
    role: z.enum(['system', 'user', 'assistant', 'developer']).describe('Message role'),
    content: z.string().describe('Message content - can include variables like {{$form.fieldName}}')
})

// Node Data schema - enhanced to include llmMessages and other inputs
const NodeDataType = z
    .object({
        name: z.string().describe('Node name (e.g., startAgentflow, llmAgentflow, conditionAgentflow)'),
        label: z.string().optional().describe('Display label for the node'),
        llmMessages: z.array(LLMMessageType).optional().describe('Array of LLM messages for llmAgentflow nodes'),
        inputs: z.record(z.any()).optional().describe('Other input values for the node'),
        conditions: z.array(z.any()).optional().describe('Conditions for conditionAgentflow nodes')
    })
    .passthrough()
    .optional()

// Node schema
const NodeType = z.object({
    id: z.string().describe('Unique identifier for the node (e.g., startAgentflow_0, llmAgentflow_1)'),
    type: z.enum(['agentFlow', 'iteration']).describe('Type of the node - always "agentFlow" except for iteration nodes'),
    position: NodePositionType.describe('Position of the node in the UI (x, y coordinates)'),
    width: z.number().describe('Width of the node (typical values: 100-300)'),
    height: z.number().describe('Height of the node (typical values: 60-100)'),
    selected: z.boolean().optional().describe('Whether the node is selected'),
    positionAbsolute: NodePositionType.optional().describe('Absolute position of the node'),
    dragging: z.boolean().optional().describe('Whether the node is being dragged'),
    data: NodeDataType.describe('Node data containing name, label, and optional llmMessages/inputs'),
    parentNode: z.string().optional().describe('Parent node ID if this is a child node (for iteration nodes)')
})

// Edge Data schema
const EdgeDataType = z
    .object({
        sourceColor: z.string().optional().describe('Color of the source node'),
        targetColor: z.string().optional().describe('Color of the target node'),
        edgeLabel: z.string().optional().describe('Label for the edge'),
        isHumanInput: z.boolean().optional().describe('Whether this is a human input edge')
    })
    .passthrough()
    .optional()

// Edge schema
const EdgeType = z.object({
    source: z.string().describe('ID of the source node (must match a node id)'),
    sourceHandle: z.string().describe('ID of the source handle (e.g., nodeName_output-handleName)'),
    target: z.string().describe('ID of the target node (must match a node id)'),
    targetHandle: z.string().describe('ID of the target handle (e.g., targetNodeName)'),
    data: EdgeDataType.optional().describe('Additional edge data'),
    type: z.string().optional().describe('Edge type (typically "agentFlow")'),
    id: z.string().optional().describe('Unique identifier for the edge'),
    label: z.string().optional().describe('Label for the edge')
})

// Main schema for workflow generation
const WorkflowType = z
    .object({
        description: z.string().optional().describe('Description of what this workflow does'),
        usecases: z.array(z.string()).optional().describe('Use cases for this workflow'),
        nodes: z
            .array(NodeType)
            .min(1, 'Workflow must have at least 1 node')
            .max(15, 'Workflow should have maximum 15 nodes')
            .describe('Array of nodes in the workflow'),
        edges: z.array(EdgeType).describe('Array of edges connecting the nodes')
    })
    .describe('Complete Agentflow workflow with nodes and edges')

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

interface NodePosition {
    x: number
    y: number
}

interface EdgeData {
    edgeLabel?: string
    sourceColor?: string
    targetColor?: string
    isHumanInput?: boolean
}

interface NodeData {
    label?: string
    name?: string
    id?: string
    inputs?: Record<string, any>
    inputAnchors?: any[]
    inputParams?: any[]
    outputs?: Record<string, any>
    outputAnchors?: any[]
    credential?: string
    color?: string
    [key: string]: any
}

interface Node {
    id: string
    type: 'agentFlow' | 'iteration'
    position: NodePosition
    width: number
    height: number
    selected?: boolean
    positionAbsolute?: NodePosition
    dragging?: boolean
    data: NodeData
    parentNode?: string
    extent?: string
}

interface Edge {
    source: string
    sourceHandle: string
    target: string
    targetHandle: string
    data?: EdgeData
    type?: string
    id?: string
    label?: string
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export const generateAgentflowv3 = async (config: Record<string, any>, question: string, options: ICommonObject) => {
    try {
        console.log('[generateAgentflowv3] ===== Starting AgentflowV3 Generation =====')
        console.log('[generateAgentflowv3] Question:', question)
        console.log('[generateAgentflowv3] Available componentNodes:', Object.keys(config.componentNodes || {}).length)

        const result = await generateWorkflow(config, question, options)

        // Check for error in result
        if ('error' in result) {
            console.error('[generateAgentflowv3] Error in generateWorkflow:', (result as any).error)
            return result
        }

        const { nodes, edges } = initializeNodesData(result, config)

        if (!nodes || nodes.length === 0) {
            console.error('[generateAgentflowv3] No valid nodes generated')
            return { error: 'No valid nodes generated from LLM response' }
        }

        console.log('[generateAgentflowv3] Before generateSelectedTools:', nodes.length, 'nodes')

        const updatedNodes = await generateSelectedTools(nodes, config, question, options)

        console.log('[generateAgentflowv3] After generateSelectedTools:', updatedNodes.length, 'nodes')

        const updatedEdges = updateEdges(edges, updatedNodes)

        console.log('[generateAgentflowv3] ===== Final Result =====')
        console.log('[generateAgentflowv3] Total nodes:', updatedNodes.length)
        console.log('[generateAgentflowv3] Total edges:', updatedEdges.length)
        console.log('[generateAgentflowv3] Node IDs:', updatedNodes.map((n) => `${n.id}(${n.data?.name})`).join(', '))
        console.log('[generateAgentflowv3] ===== Generation Complete =====')

        return { nodes: updatedNodes, edges: updatedEdges }
    } catch (error) {
        console.error('[generateAgentflowv3] Error generating AgentflowV3:', error)
        return { error: error.message || 'Unknown error occurred' }
    }
}

// ============================================================================
// EDGE UPDATE FUNCTIONS
// ============================================================================

const updateEdges = (edges: Edge[], nodes: Node[]): Edge[] => {
    console.log('[updateEdges] Processing', edges.length, 'edges with', nodes.length, 'nodes')

    const isMultiOutput = (source: string) => {
        return source.includes('conditionAgentflow') || source.includes('conditionAgentAgentflow') || source.includes('humanInputAgentflow')
    }

    const findNodeColor = (nodeId: string) => {
        const node = nodes.find((node) => node.id === nodeId)
        return node?.data?.color
    }

    // Log all node IDs for debugging
    const nodeIds = nodes.map((n) => n.id)
    console.log('[updateEdges] Available node IDs:', nodeIds)

    // Filter out edges that reference non-existent nodes
    const originalEdgesLength = edges.length
    edges = edges.filter((edge) => {
        const sourceExists = nodes.some((node) => node.id === edge.source)
        const targetExists = nodes.some((node) => node.id === edge.target)
        if (!sourceExists) {
            console.warn(`[updateEdges] Edge filtered out: source node "${edge.source}" not found`, edge)
        }
        if (!targetExists) {
            console.warn(`[updateEdges] Edge filtered out: target node "${edge.target}" not found`, edge)
        }
        return sourceExists && targetExists
    })
    console.log(`[updateEdges] Filtered out ${originalEdgesLength - edges.length} edges with missing nodes`)

    // Filter out edges with hideInput/hideOutput
    const indexToDelete = []
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i]
        const sourceNode = nodes.find((node) => node.id === edge.source)
        if (sourceNode?.data?.hideOutput) {
            indexToDelete.push(i)
        }

        const targetNode = nodes.find((node) => node.id === edge.target)
        if (targetNode?.data?.hideInput) {
            indexToDelete.push(i)
        }
    }

    // Delete edges at the indexes
    for (let i = indexToDelete.length - 1; i >= 0; i -= 1) {
        edges.splice(indexToDelete[i], 1)
    }

    // Update edges with metadata
    const updatedEdges = edges.map((edge) => {
        return {
            ...edge,
            data: {
                ...edge.data,
                sourceColor: findNodeColor(edge.source),
                targetColor: findNodeColor(edge.target),
                edgeLabel: isMultiOutput(edge.source) && edge.label && edge.label.trim() !== '' ? edge.label.trim() : undefined,
                isHumanInput: edge.source.includes('humanInputAgentflow') ? true : false
            },
            type: 'agentFlow',
            id: `${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}`
        }
    }) as Edge[]

    // Fix multi-output handle names
    if (updatedEdges.length > 0) {
        updatedEdges.forEach((edge) => {
            if (isMultiOutput(edge.source)) {
                if (edge.sourceHandle.includes('true')) {
                    edge.sourceHandle = edge.sourceHandle.replace('true', '0')
                } else if (edge.sourceHandle.includes('false')) {
                    edge.sourceHandle = edge.sourceHandle.replace('false', '1')
                }
            }
        })
    }

    console.log(`[updateEdges] Final edges count: ${updatedEdges.length}`)
    updatedEdges.forEach((edge, idx) => {
        console.log(`[updateEdges] Edge ${idx}: ${edge.source} (${edge.sourceHandle}) -> ${edge.target} (${edge.targetHandle})`)
    })

    return updatedEdges
}

// ============================================================================
// TOOL SELECTION FUNCTIONS
// ============================================================================

const generateSelectedTools = async (nodes: Node[], config: Record<string, any>, question: string, options: ICommonObject) => {
    const selectedTools: string[] = []

    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]
        if (!node.data.inputs) {
            node.data.inputs = {}
        }

        if (node.data.name === 'agentAgentflow') {
            const sysPrompt = `You are a workflow orchestrator that is designed to make agent coordination and execution easy. Your goal is to select the tools that are needed to achieve the given task.

Here are the tools to choose from:
${config.toolNodes}

Here's the selected tools:
${JSON.stringify(selectedTools, null, 2)}

Output Format should be a list of tool names:
For example:["googleCustomSearch", "slackMCP"]

Now, select the tools that are needed to achieve the given task. You must only select tools that are in the list of tools above. You must NOT select the tools that are already in the list of selected tools.
`
            const tools = await _generateSelectedTools({ ...config, prompt: sysPrompt }, question, options)
            if (Array.isArray(tools) && tools.length > 0) {
                selectedTools.push(...tools)

                const existingTools = node.data.inputs.agentTools || []
                node.data.inputs.agentTools = [
                    ...existingTools,
                    ...tools.map((tool) => ({
                        agentSelectedTool: tool,
                        agentSelectedToolConfig: {
                            agentSelectedTool: tool
                        }
                    }))
                ]
            }
        } else if (node.data.name === 'toolAgentflow') {
            const sysPrompt = `You are a workflow orchestrator that is designed to make agent coordination and execution easy. Your goal is to select ONE tool that is needed to achieve the given task.

Here are the tools to choose from:
${config.toolNodes}

Here's the selected tools:
${JSON.stringify(selectedTools, null, 2)}

Output Format should ONLY one tool name inside of a list:
For example:["googleCustomSearch"]

Now, select the ONLY tool that is needed to achieve the given task. You must only select tool that is in the list of tools above. You must NOT select the tool that is already in the list of selected tools.
`
            const tools = await _generateSelectedTools({ ...config, prompt: sysPrompt }, question, options)
            if (Array.isArray(tools) && tools.length > 0) {
                selectedTools.push(...tools)

                node.data.inputs.toolAgentflowSelectedTool = tools[0]
                node.data.inputs.toolInputArgs = []
                node.data.inputs.toolAgentflowSelectedToolConfig = {
                    toolAgentflowSelectedTool: tools[0]
                }
            }
        }
    }

    return nodes
}

const _generateSelectedTools = async (config: Record<string, any>, question: string, options: ICommonObject) => {
    try {
        const chatModelComponent = config.componentNodes[config.selectedChatModel?.name]
        if (!chatModelComponent) {
            throw new Error('Chat model component not found')
        }
        const nodeInstanceFilePath = chatModelComponent.filePath as string
        const nodeModule = await import(nodeInstanceFilePath)
        const newToolNodeInstance = new nodeModule.nodeClass()
        const model = (await newToolNodeInstance.init(config.selectedChatModel, '', options)) as BaseChatModel

        // Try to use withStructuredOutput if available
        // @ts-ignore
        if (typeof model.withStructuredOutput === 'function') {
            try {
                // @ts-ignore
                const structuredLLM = model.withStructuredOutput(ToolType)
                const structuredResponse = await structuredLLM.invoke([
                    { role: 'system', content: config.prompt },
                    { role: 'user', content: question }
                ])
                return structuredResponse
            } catch (structuredError) {
                console.warn('[_generateSelectedTools] Structured output failed, falling back:', structuredError)
            }
        }

        // Fallback: Manual parsing
        const parser = StructuredOutputParser.fromZodSchema(ToolType as any)
        const formatInstructions = parser.getFormatInstructions()

        const messages = [
            {
                role: 'system',
                content: `${config.prompt}\n\n${formatInstructions}\n\nMake sure to follow the exact JSON schema structure.`
            },
            {
                role: 'user',
                content: question
            }
        ]

        const response = await model.invoke(messages)
        const responseContent = response.content.toString()
        const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || responseContent.match(/{[\s\S]*?}/)

        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0]
            try {
                const repairedJson = jsonrepair(jsonStr)
                const parsedJSON = JSON.parse(repairedJson)
                return ToolType.parse(parsedJSON)
            } catch (parseError) {
                console.error('[_generateSelectedTools] Error parsing JSON:', parseError)
                return { error: 'Failed to parse JSON from response', content: responseContent }
            }
        } else {
            console.error('[_generateSelectedTools] No JSON found in response:', responseContent)
            return { error: 'No JSON found in response', content: responseContent }
        }
    } catch (error) {
        console.error('[_generateSelectedTools] Error:', error)
        return { error: error.message || 'Unknown error occurred' }
    }
}

// ============================================================================
// WORKFLOW GENERATION FUNCTIONS
// ============================================================================

const generateWorkflow = async (config: Record<string, any>, question: string, options?: ICommonObject) => {
    try {
        console.log('[generateWorkflow] Starting workflow generation for question:', question)

        const chatModelComponent = config.componentNodes[config.selectedChatModel?.name]
        if (!chatModelComponent) {
            throw new Error('Chat model component not found')
        }
        const nodeInstanceFilePath = chatModelComponent.filePath as string
        const nodeModule = await import(nodeInstanceFilePath)
        const newToolNodeInstance = new nodeModule.nodeClass()
        const model = (await newToolNodeInstance.init(config.selectedChatModel, '', options)) as BaseChatModel

        // Create parser and format instructions
        const parser = StructuredOutputParser.fromZodSchema(WorkflowType as any)
        const formatInstructions = parser.getFormatInstructions()

        // Build messages with enhanced prompt
        const messages = [
            {
                role: 'system',
                content: `${buildEnhancedPrompt(
                    config
                )}\n\n${formatInstructions}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no extra text.`
            },
            {
                role: 'user',
                content: question
            }
        ]

        // Try to use withStructuredOutput if available
        // @ts-ignore
        if (typeof model.withStructuredOutput === 'function') {
            try {
                console.log('[generateWorkflow] Using withStructuredOutput')
                // @ts-ignore
                const structuredLLM = model.withStructuredOutput(WorkflowType)
                const structuredResponse = await structuredLLM.invoke(messages)
                console.log(
                    '[generateWorkflow] Structured output received, nodes:',
                    structuredResponse.nodes?.length,
                    'edges:',
                    structuredResponse.edges?.length
                )
                return structuredResponse
            } catch (structuredError) {
                console.warn('[generateWorkflow] Structured output failed, falling back:', structuredError)
            }
        }

        // Fallback: Manual parsing
        console.log('[generateWorkflow] Using manual parsing fallback')
        const response = await model.invoke(messages)
        const responseContent = response.content.toString()
        console.log('[generateWorkflow] Raw response length:', responseContent.length)

        const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || responseContent.match(/{[\s\S]*?}/)

        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0]
            try {
                const repairedJson = jsonrepair(jsonStr)
                const parsedJSON = JSON.parse(repairedJson)
                console.log('[generateWorkflow] Parsed JSON, nodes:', parsedJSON.nodes?.length, 'edges:', parsedJSON.edges?.length)
                const validated = WorkflowType.parse(parsedJSON)
                console.log('[generateWorkflow] Validation passed')
                return validated
            } catch (parseError) {
                console.error('[generateWorkflow] Error parsing JSON:', parseError)
                return { error: 'Failed to parse JSON from response', content: responseContent }
            }
        } else {
            console.error('[generateWorkflow] No JSON found in response:', responseContent.substring(0, 500))
            return { error: 'No JSON found in response', content: responseContent }
        }
    } catch (error) {
        console.error('[generateWorkflow] Error:', error)
        return { error: error.message || 'Unknown error occurred' }
    }
}

// ============================================================================
// ENHANCED PROMPT BUILDER
// ============================================================================

const buildEnhancedPrompt = (config: Record<string, any>) => {
    return `You are an expert workflow orchestrator. Generate a valid JSON workflow with "nodes" and "edges" arrays.

${config.prompt}

CRITICAL REQUIREMENTS:
1. First node MUST be "startAgentflow" with type "agentFlow"
2. Every edge.source and edge.target MUST match an existing node.id
3. Node IDs must be unique (use pattern: nodeName_0, nodeName_1, etc.)
4. Position nodes logically (increment x by 300-400 for sequential flow)
5. Typical node dimensions: width=100-250, height=60-80

NODE STRUCTURE (each node in "nodes" array):
{
  "id": "nodeName_0",
  "type": "agentFlow",
  "position": { "x": 0, "y": 0 },
  "width": 150,
  "height": 70,
  "data": {
    "name": "nodeName",
    "label": "Display Label"
  }
}

EDGE STRUCTURE (each edge in "edges" array):
{
  "source": "sourceNode_0",
  "sourceHandle": "sourceNode_0-output-sourceNode",
  "target": "targetNode_0",
  "targetHandle": "targetNode_0"
}

HANDLE NAMING RULES:
- sourceHandle: "{nodeId}-output-{nodeName}"
- targetHandle: "{targetNodeId}"
- For condition nodes, handles are: "{nodeId}-output-0" and "{nodeId}-output-1"

POSITIONING GUIDE:
- Start node: x=0, y=0
- Second node: x=300, y=0
- Third node: x=600, y=0
- For branches, increment y by 100

ADVANCED NODE CONFIGURATION:

For llmAgentflow nodes, ADD llmMessages to make the workflow immediately usable:
{
  "id": "llmAgentflow_0",
  "type": "agentFlow",
  "position": { "x": 300, "y": 0 },
  "width": 180,
  "height": 70,
  "data": {
    "name": "llmAgentflow",
    "label": "Process Request",
    "llmMessages": [
      {
        "role": "system",
        "content": "You are a helpful assistant. Process the user's request: {{ $form.question }}"
      }
    ]
  }
}

VARIABLE REFERENCE GUIDE:
- {{$form.fieldName}} - Reference form input from startAgentflow
- {{$flow.state.keyName}} - Reference flow state
- {{$node.output.field}} - Reference output from previous nodes

For conditionAgentflow nodes, ADD conditions:
{
  "id": "conditionAgentflow_0",
  "data": {
    "name": "conditionAgentflow",
    "conditions": [
      {
        "type": "string",
        "value1": "{{ $flow.state.status }}",
        "operation": "equal",
        "value2": "approved"
      }
    ]
  }
}

For startAgentflow nodes with form input, ADD inputs:
{
  "id": "startAgentflow_0",
  "data": {
    "name": "startAgentflow",
    "inputs": {
      "startInputType": "formInput",
      "formTitle": "Enter Your Details",
      "formInputTypes": [
        { "type": "string", "label": "Name", "name": "userName" },
        { "type": "string", "label": "Email", "name": "userEmail" }
      ]
    }
  }
}

Return ONLY the JSON object. No explanation, no markdown blocks.`
}

// ============================================================================
// NODE INITIALIZATION FUNCTIONS
// ============================================================================

const initializeNodesData = (result: Record<string, any>, config: Record<string, any>) => {
    try {
        if (result.error) {
            console.error('[initializeNodesData] Error in result:', result.error)
            return result
        }

        let nodes = result.nodes
        const validNodes = []
        const invalidNodes = []

        console.log('[initializeNodesData] Processing', nodes.length, 'nodes')

        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            let nodeName = node.data?.name

            console.log(`[initializeNodesData] Processing node ${i}:`, {
                id: node.id,
                dataName: nodeName,
                nodeType: node.type
            })

            // If nodeName is not found in data.name, try extracting from node.id
            if (!nodeName || !config.componentNodes[nodeName]) {
                const extractedName = node.id.split('_')[0]
                console.log(
                    `[initializeNodesData] nodeName "${nodeName}" not found in componentNodes, trying extracted name: "${extractedName}"`
                )
                nodeName = extractedName
            }

            const componentNode = config.componentNodes[nodeName]
            if (!componentNode) {
                console.warn(`[initializeNodesData] Component node not found for "${nodeName}", skipping node`, node.id)
                invalidNodes.push({ ...node, reason: `ComponentNode not found: ${nodeName}` })
                continue
            }

            const initializedNodeData = initNode(cloneDeep(componentNode), node.id)

            // Apply LLM-generated data to the node
            const llmGeneratedData = node.data || {}

            // Merge with initialized data, preserving LLM-generated fields
            nodes[i].data = {
                ...initializedNodeData,
                label: llmGeneratedData.label || initializedNodeData.label,
                // Preserve llmMessages if provided by LLM
                inputs: {
                    ...initializedNodeData.inputs,
                    // Apply llmMessages for llmAgentflow nodes
                    ...(llmGeneratedData.llmMessages && nodeName === 'llmAgentflow'
                        ? {
                              llmMessages: llmGeneratedData.llmMessages
                          }
                        : {}),
                    // Apply other LLM-generated inputs
                    ...(llmGeneratedData.inputs || {})
                }
            }

            // Apply conditions for conditionAgentflow nodes
            if (nodeName === 'conditionAgentflow' && llmGeneratedData.conditions) {
                nodes[i].data.inputs.conditions = llmGeneratedData.conditions
            }

            // Apply inputs for startAgentflow nodes (form inputs, etc.)
            if (nodeName === 'startAgentflow' && llmGeneratedData.inputs) {
                nodes[i].data.inputs = {
                    ...nodes[i].data.inputs,
                    ...llmGeneratedData.inputs
                }
            }

            if (nodes[i].data.name === 'iterationAgentflow') {
                nodes[i].type = 'iteration'
            }

            if (nodes[i].parentNode) {
                nodes[i].extent = 'parent'
            }

            validNodes.push(nodes[i])
        }

        if (invalidNodes.length > 0) {
            console.warn(`[initializeNodesData] Skipped ${invalidNodes.length} invalid nodes:`, invalidNodes)
        }

        console.log(`[initializeNodesData] Successfully processed ${validNodes.length} out of ${nodes.length} nodes`)

        return { nodes: validNodes, edges: result.edges }
    } catch (error) {
        console.error('[initializeNodesData] Error:', error)
        return { error: error.message || 'Unknown error occurred' }
    }
}

const initNode = (nodeData: Record<string, any>, newNodeId: string): NodeData => {
    const inputParams = []
    const incoming = nodeData.inputs ? nodeData.inputs.length : 0

    // Inputs
    for (let i = 0; i < incoming; i += 1) {
        const newInput = {
            ...nodeData.inputs[i],
            id: `${newNodeId}-input-${nodeData.inputs[i].name}-${nodeData.inputs[i].type}`
        }
        inputParams.push(newInput)
    }

    // Credential
    if (nodeData.credential) {
        const newInput = {
            ...nodeData.credential,
            id: `${newNodeId}-input-${nodeData.credential.name}-${nodeData.credential.type}`
        }
        inputParams.unshift(newInput)
    }

    // Outputs
    let outputAnchors = initializeOutputAnchors(nodeData, newNodeId)

    // Inputs
    if (nodeData.inputs) {
        const defaultInputs = initializeDefaultNodeData(nodeData.inputs)
        nodeData.inputAnchors = showHideInputAnchors({ ...nodeData, inputAnchors: [], inputs: defaultInputs })
        nodeData.inputParams = showHideInputParams({ ...nodeData, inputParams, inputs: defaultInputs })
        nodeData.inputs = defaultInputs
    } else {
        nodeData.inputAnchors = []
        nodeData.inputParams = []
        nodeData.inputs = {}
    }

    // Outputs
    if (nodeData.outputs) {
        nodeData.outputs = initializeDefaultNodeData(outputAnchors)
    } else {
        nodeData.outputs = {}
    }
    nodeData.outputAnchors = outputAnchors

    // Credential
    if (nodeData.credential) nodeData.credential = ''

    nodeData.id = newNodeId

    return nodeData
}

const initializeDefaultNodeData = (nodeParams: Record<string, any>[]) => {
    const initialValues: Record<string, any> = {}

    for (let i = 0; i < nodeParams.length; i += 1) {
        const input = nodeParams[i]
        initialValues[input.name] = input.default || ''
    }

    return initialValues
}

const createAgentFlowOutputs = (nodeData: Record<string, any>, newNodeId: string) => {
    if (nodeData.hideOutput) return []

    if (nodeData.outputs?.length) {
        return nodeData.outputs.map((_: any, index: number) => ({
            id: `${newNodeId}-output-${index}`,
            label: nodeData.label,
            name: nodeData.name
        }))
    }

    return [
        {
            id: `${newNodeId}-output-${nodeData.name}`,
            label: nodeData.label,
            name: nodeData.name
        }
    ]
}

const initializeOutputAnchors = (nodeData: Record<string, any>, newNodeId: string) => {
    return createAgentFlowOutputs(nodeData, newNodeId)
}

const _showHideOperation = (nodeData: Record<string, any>, inputParam: Record<string, any>, displayType: string, index?: number) => {
    const displayOptions = inputParam[displayType]
    Object.keys(displayOptions).forEach((path) => {
        const comparisonValue = displayOptions[path]
        if (path.includes('$index') && index) {
            path = path.replace('$index', index.toString())
        }
        let groundValue = get(nodeData.inputs, path, '')
        if (groundValue && typeof groundValue === 'string' && groundValue.startsWith('[') && groundValue.endsWith(']')) {
            groundValue = JSON.parse(groundValue)
        }

        // Handle case where groundValue is an array
        if (Array.isArray(groundValue)) {
            if (Array.isArray(comparisonValue)) {
                const hasIntersection = comparisonValue.some((val) => groundValue.includes(val))
                if (displayType === 'show' && !hasIntersection) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && hasIntersection) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'string') {
                const matchFound = groundValue.some((val) => comparisonValue === val || new RegExp(comparisonValue).test(val))
                if (displayType === 'show' && !matchFound) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && matchFound) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'boolean' || typeof comparisonValue === 'number') {
                const matchFound = groundValue.includes(comparisonValue)
                if (displayType === 'show' && !matchFound) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && matchFound) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'object') {
                const matchFound = groundValue.some((val) => isEqual(comparisonValue, val))
                if (displayType === 'show' && !matchFound) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && matchFound) {
                    inputParam.display = false
                }
            }
        } else {
            // Original logic for non-array groundValue
            if (Array.isArray(comparisonValue)) {
                if (displayType === 'show' && !comparisonValue.includes(groundValue)) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && comparisonValue.includes(groundValue)) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'string') {
                if (displayType === 'show' && !(comparisonValue === groundValue || new RegExp(comparisonValue).test(groundValue))) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && (comparisonValue === groundValue || new RegExp(comparisonValue).test(groundValue))) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'boolean') {
                if (displayType === 'show' && comparisonValue !== groundValue) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && comparisonValue === groundValue) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'object') {
                if (displayType === 'show' && !isEqual(comparisonValue, groundValue)) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && isEqual(comparisonValue, groundValue)) {
                    inputParam.display = false
                }
            } else if (typeof comparisonValue === 'number') {
                if (displayType === 'show' && comparisonValue !== groundValue) {
                    inputParam.display = false
                }
                if (displayType === 'hide' && comparisonValue === groundValue) {
                    inputParam.display = false
                }
            }
        }
    })
}

const showHideInputs = (nodeData: Record<string, any>, inputType: string, overrideParams?: Record<string, any>, arrayIndex?: number) => {
    const params = overrideParams ?? nodeData[inputType] ?? []

    for (let i = 0; i < params.length; i += 1) {
        const inputParam = params[i]

        // Reset display flag to false for each inputParam
        inputParam.display = true

        if (inputParam.show) {
            _showHideOperation(nodeData, inputParam, 'show', arrayIndex)
        }
        if (inputParam.hide) {
            _showHideOperation(nodeData, inputParam, 'hide', arrayIndex)
        }
    }

    return params
}

const showHideInputParams = (nodeData: Record<string, any>): any[] => {
    return showHideInputs(nodeData, 'inputParams')
}

const showHideInputAnchors = (nodeData: Record<string, any>): any[] => {
    return showHideInputs(nodeData, 'inputAnchors')
}
