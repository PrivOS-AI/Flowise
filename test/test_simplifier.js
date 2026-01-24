
// Mock initNode
const initNode = (node, id) => {
    return {
        ...node,
        id: id,
        inputs: { ...node.inputs } // Clone defaults
    }
}

// Mock cloneDeep
const cloneDeep = (obj) => JSON.parse(JSON.stringify(obj))

// Mock nodeDefaults
const nodeDefaults = {}

// --- HELPER FUNCTIONS FOR FUZZY MATCHING (COPIED FROM SOURCE) ---
const levenshtein = (a, b) => {
    const tmp = b
    const matrix = []
    let i
    let j

    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    for (i = 0; i <= b.length; i++) matrix[i] = [i]
    for (j = 0; j <= a.length; j++) matrix[0][j] = j

    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                )
            }
        }
    }
    return matrix[b.length][a.length]
}

const findBestMatch = (key, inputParams) => {
    const normalizedKey = key.toLowerCase()
    let bestMatch = null
    let minDistance = Infinity

    for (const param of inputParams) {
        const paramName = param.name
        const paramLabel = (param.label || '').toLowerCase()

        if (paramName.toLowerCase() === normalizedKey) return paramName
        if (paramLabel === normalizedKey) return paramName

        const distName = levenshtein(normalizedKey, paramName.toLowerCase())
        if (distName < minDistance && distName <= 2) {
            minDistance = distName
            bestMatch = paramName
        }

        const distLabel = levenshtein(normalizedKey, paramLabel)
        if (distLabel < minDistance && distLabel <= 2) {
            minDistance = distLabel
            bestMatch = paramName
        }
    }
    return bestMatch
}

const findBestOptionMatch = (value, options) => {
    const normalizedVal = String(value).toLowerCase()
    let bestMatch = value
    let minDistance = Infinity

    for (const opt of options) {
        const optName = typeof opt === 'string' ? opt : opt.name
        const optLabel = typeof opt === 'string' ? opt : opt.label || ''

        if (optName.toLowerCase() === normalizedVal) return optName
        if (optLabel.toLowerCase() === normalizedVal) return optName

        const distName = levenshtein(normalizedVal, optName.toLowerCase())
        if (distName < minDistance && distName <= 2) {
            minDistance = distName
            bestMatch = optName
        }

        const distLabel = levenshtein(normalizedVal, optLabel.toLowerCase())
        if (distLabel < minDistance && distLabel <= 2) {
            minDistance = distLabel
            bestMatch = optName
        }
    }
    return bestMatch
}

const expandVariables = (text, idMapping) => {
    if (typeof text !== 'string') return text

    // 1. $question
    text = text.replace(
        /\$question/g,
        `<p><span class="variable" data-type="mention" data-id="question" data-label="question">{{ question }}</span> </p>`
    )

    // 2. $form.variable
    text = text.replace(/\$form\.([\w_]+)/g, (match, varName) => {
        const fullVar = `$form.${varName}`
        return `<p><span class="variable" data-type="mention" data-id="${fullVar}" data-label="${fullVar}">{{ ${fullVar} }}</span> </p>`
    })

    // 3. Node IDs ($1, $2, etc.)
    text = text.replace(/\$([a-zA-Z0-9_]+)/g, (match, id) => {
        const realId = idMapping[id]
        if (realId) {
            return `<p><span class="variable" data-type="mention" data-id="${realId}" data-label="${realId}">{{ ${realId} }}</span> </p>`
        }
        return match
    })

    return text
}

// inflateFlow Function
const inflateFlow = (minifiedFlow, typeMap, componentNodes) => {
    const inflatedNodes = []
    const inflatedEdges = []
    const idMapping = {}
    const nodeCounters = {}

    // 1. First Pass: Create ID Mapping
    if (minifiedFlow.nodes && Array.isArray(minifiedFlow.nodes)) {
        minifiedFlow.nodes.forEach((nodeItem, index) => {
            let simpleNode = nodeItem
            if (typeof nodeItem === 'object' && !nodeItem.id) {
                simpleNode = {
                    ...nodeItem,
                    id: nodeItem.id || nodeItem.index || (index + 1)
                }
            }
            const nodeName = typeMap[simpleNode.typeId]
            if (!nodeName) return

            if (!nodeCounters[nodeName] && nodeCounters[nodeName] !== 0) {
                nodeCounters[nodeName] = 0
            }
            const realId = `${nodeName}_${nodeCounters[nodeName]}`
            nodeCounters[nodeName]++
            idMapping[simpleNode.id] = realId
        })
    }

    // Reset counters for actual inflation
    Object.keys(nodeCounters).forEach(k => nodeCounters[k] = 0);

    // 2. Inflate Nodes
    if (minifiedFlow.nodes && Array.isArray(minifiedFlow.nodes)) {
        minifiedFlow.nodes.forEach((nodeItem, index) => {
            let simpleNode = nodeItem
            if (typeof nodeItem === 'object' && !nodeItem.id) {
                simpleNode = {
                    ...nodeItem,
                    id: nodeItem.id || nodeItem.index || (index + 1)
                }
            }

            const nodeName = typeMap[simpleNode.typeId]
            if (!nodeName) return

            const componentNode = componentNodes[nodeName]
            if (!componentNode) return

            if (!nodeCounters[nodeName] && nodeCounters[nodeName] !== 0) nodeCounters[nodeName] = 0
            const realId = `${nodeName}_${nodeCounters[nodeName]}`
            nodeCounters[nodeName]++

            const nodeData = initNode(cloneDeep(componentNode), realId)
            if (!nodeData.inputs) nodeData.inputs = {}

            if (nodeData.inputParams && Array.isArray(nodeData.inputParams)) {
                nodeData.inputParams.forEach((param) => {
                    if (!param.id) param.id = `${realId}-input-${param.name}-${param.type}`
                })
            }

            nodeData.label = simpleNode.label || nodeData.label

            if (simpleNode.messages) {
                nodeData.inputs.agentMessages = simpleNode.messages
            }

            // SMART MERGE LOGIC
            if (simpleNode.inputs && nodeData.inputParams) {

                // AUTO-DETECT START NODE TYPE
                if (nodeName === 'startAgentflow') {
                    if (simpleNode.inputs.formInputTypes && simpleNode.inputs.formInputTypes.length > 0) {
                        if (!simpleNode.inputs.startInputType) {
                            nodeData.inputs.startInputType = 'formInput'
                        }
                    }
                }

                // SPECIAL HANDLING: Agent Node System Prompt
                if (nodeName === 'agentAgentflow') {
                    if (simpleNode.inputs.agentSystemPrompt) {
                        const sysPrompt = simpleNode.inputs.agentSystemPrompt
                        if (!nodeData.inputs.agentMessages) {
                            nodeData.inputs.agentMessages = []
                        }
                        nodeData.inputs.agentMessages.unshift({
                            role: 'system',
                            content: sysPrompt
                        })
                    }
                }

                Object.keys(simpleNode.inputs).forEach((key) => {
                    const mappedKey = findBestMatch(key, nodeData.inputParams)

                    if (mappedKey) {
                        let value = simpleNode.inputs[key]

                        // EXPAND VARIABLES (String inputs only)
                        if (typeof value === 'string') {
                            value = expandVariables(value, idMapping)
                        }

                        const paramDef = nodeData.inputParams.find((p) => p.name === mappedKey)

                        // Match Option Values
                        if (
                            paramDef &&
                            (paramDef.type === 'options' || paramDef.type === 'asyncOptions' || paramDef.type === 'multiOptions')
                        ) {
                            if (paramDef.options && Array.isArray(paramDef.options)) {
                                if (Array.isArray(value)) {
                                    value = value.map((v) => findBestOptionMatch(v, paramDef.options))
                                } else {
                                    value = findBestOptionMatch(value, paramDef.options)
                                }
                            }
                        }

                        nodeData.inputs[mappedKey] = value
                    }
                })
            }

            const position = { x: index * 350, y: 100 }

            inflatedNodes.push({
                id: realId,
                type: 'agentFlow',
                position,
                data: nodeData,
                width: 200,
                height: 100
            })
        })
    }
    return { nodes: inflatedNodes, edges: [] }
}

// --- RUN TEST ---

const componentNodes = {
    'startAgentflow': {
        name: 'startAgentflow',
        label: 'Start',
        category: 'Agent Flows',
        inputParams: [
            { name: 'startInputType', type: 'options', options: [{ name: 'chatInput' }, { name: 'formInput' }] },
            { name: 'formInputTypes', type: 'array' }
        ],
        inputs: { startInputType: 'chatInput' }
    },
    'agentAgentflow': {
        name: 'agentAgentflow',
        label: 'Agent',
        category: 'Agent Flows',
        inputParams: [
            { name: 'agentModel', type: 'asyncOptions', options: [{ name: 'claude-3-sonnet' }, { name: 'gpt-4' }] },
            { name: 'agentMessages', type: 'array' }
        ],
        inputs: {}
    }
}

const typeMap = { 1: 'startAgentflow', 2: 'agentAgentflow' }

const minifiedFlow = {
    nodes: [
        {
            id: 1,
            typeId: 1,
            label: "Start Node",
            inputs: {
                "formInputTypes": [{ name: "myField", type: "string" }]
            }
        },
        {
            id: 2,
            typeId: 2,
            label: "Agent Node",
            inputs: {
                "agentSystemPrompt": "You are a helpful assistant", // User provided input
                "agentModel": "claude-3-sonnet"
            }
        }
    ],
    edges: []
}

const result = inflateFlow(minifiedFlow, typeMap, componentNodes)
const agentNode = result.nodes[1]

console.log("Agent Node Inputs:", agentNode ? agentNode.data.inputs : "Node missing")


if (agentNode && agentNode.data.inputs.agentMessages && agentNode.data.inputs.agentMessages.length > 0) {
    const firstMsg = agentNode.data.inputs.agentMessages[0]
    if (firstMsg.role === 'system' && firstMsg.content === 'You are a helpful assistant') {
        console.log("PASS: Agent System Prompt mapped to agentMessages")
    } else {
        console.log("FAIL: Agent System Prompt mapping incorrect", firstMsg)
    }
} else {
    console.log("FAIL: Agent agentMessages empty or missing")
}

// Write output to file
const fs = require('fs');
const path = require('path');
const outputPath = path.join(__dirname, 'simplifier_output.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`Output saved to: ${outputPath}`);
