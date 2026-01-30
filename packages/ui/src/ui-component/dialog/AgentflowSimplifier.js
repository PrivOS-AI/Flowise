import { initNode } from '@/utils/genericHelper'
import { cloneDeep } from 'lodash'
import { nodeDefaults } from './NodeTypeMap'

// ============================================================================
// HELPER: Generate Type Map
// Scans available components and assigns short numeric IDs (1, 2, 3...)
// Returns:
// 1. typeMap: { 1: 'startAgentflow', 2: 'agentAgentflow' ... }
// 2. reverseMap: { 'startAgentflow': 1, ... }
// 3. menuString: "1: Start (Starting point...)\n2: Agent (Dynamically choose...)"
// ============================================================================
export const generateTypeMap = (componentNodes) => {
    const typeMap = {}
    const reverseMap = {}
    let menuItems = []
    let idCounter = 1

    // Filter for Agent Flows and PrivOS categories
    const agentNodes = Object.values(componentNodes).filter(
        node => node.category === 'Agent Flows' || node.category === 'PrivOS'
    )

    // Sort to ensure deterministic IDs (Start first, then alphabetical)
    agentNodes.sort((a, b) => {
        if (a.name === 'startAgentflow') return -1
        if (b.name === 'startAgentflow') return 1
        return a.label.localeCompare(b.label)
    })

    agentNodes.forEach(node => {
        const id = idCounter++
        typeMap[id] = node.name
        reverseMap[node.name] = id
        menuItems.push(`${id}: ${node.label} - ${node.description}`)
    })

    return {
        typeMap,
        reverseMap,
        menuString: menuItems.join('\n')
    }
}

// ============================================================================
// HELPER: Fuzzy Matching Logic
// ============================================================================

const levenshtein = (a, b) => {
    const tmp = b
    const matrix = []
    let i
    let j

    if (a.length === 0) {
        return b.length
    }
    if (b.length === 0) {
        return a.length
    }

    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
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

        // 1. Exact Name (Case Insensitive)
        if (paramName.toLowerCase() === normalizedKey) return paramName

        // 2. Exact Label (Case Insensitive)
        if (paramLabel === normalizedKey) return paramName

        // 3. Fuzzy Match Name
        const distName = levenshtein(normalizedKey, paramName.toLowerCase())
        if (distName < minDistance && distName <= 2) {
            minDistance = distName
            bestMatch = paramName
        }

        // 4. Fuzzy Match Label
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

    let bestMatch = value // Default to original if no better match found
    let minDistance = Infinity

    for (const opt of options) {
        const optName = typeof opt === 'string' ? opt : opt.name
        const optLabel = typeof opt === 'string' ? opt : opt.label || ''

        // Exact Name Match
        if (optName.toLowerCase() === normalizedVal) return optName
        // Exact Label Match
        if (optLabel.toLowerCase() === normalizedVal) return optName

        // Fuzzy Name
        const distName = levenshtein(normalizedVal, optName.toLowerCase())
        if (distName < minDistance && distName <= 2) {
            minDistance = distName
            bestMatch = optName
        }

        // Fuzzy Label
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
    // Format: <p><span class="variable" data-type="mention" data-id="question" data-label="question">{{ question }}</span> </p>
    text = text.replace(
        /\$question/g,
        `<p><span class="variable" data-type="mention" data-id="question" data-label="question">{{ question }}</span> </p>`
    )

    // 2. $form.variable
    // Format: <p><span class="variable" data-type="mention" data-id="$form.param_1" data-label="$form.param_1">{{ $form.param_1 }}</span> </p>
    text = text.replace(/\$form\.([\w_]+)/g, (match, varName) => {
        const fullVar = `$form.${varName}`
        return `<p><span class="variable" data-type="mention" data-id="${fullVar}" data-label="${fullVar}">{{ ${fullVar} }}</span> </p>`
    })

    // 3. Node IDs ($1, $2, etc.)
    // Format: <p><span class="variable" data-type="mention" data-id="agentAgentflow_0" data-label="agentAgentflow_0">{{ agentAgentflow_0 }}</span> </p>
    text = text.replace(/\$([a-zA-Z0-9_]+)/g, (match, id) => {
        const realId = idMapping[id]
        if (realId) {
            return `<p><span class="variable" data-type="mention" data-id="${realId}" data-label="${realId}">{{ ${realId} }}</span> </p>`
        }
        return match
    })

    return text
}

// ============================================================================
// HELPER: Inflate Flow
// Converts simplified { nodes: [{id, typeId, label}], edges: ["1-2"] }
// into full Flowise { nodes: [...], edges: [...] }
// ============================================================================
export const inflateFlow = (minifiedFlow, typeMap, componentNodes) => {
    const inflatedNodes = []
    const inflatedEdges = []
    const idMapping = {} // Map minified ID (e.g. 10) to Real ID (e.g. agentAgentflow_0)
    const nodeCounters = {} // Track count for each node type

    // 1. First Pass: Create ID Mapping
    // We need all IDs mapped BEFORE we process inputs, because inputs might reference future nodes
    if (minifiedFlow.nodes && Array.isArray(minifiedFlow.nodes)) {
        minifiedFlow.nodes.forEach((nodeItem, index) => {
            let simpleNode = nodeItem
            if (typeof nodeItem === 'object' && !nodeItem.id) {
                simpleNode = {
                    ...nodeItem,
                    id: nodeItem.id || nodeItem.index || (index + 1)
                }
            }
            const nodeName = typeMap[simpleNode.typeId] || simpleNode.name || simpleNode.type
            if (!nodeName) return // Skip unknown

            if (!nodeCounters[nodeName] && nodeCounters[nodeName] !== 0) {
                nodeCounters[nodeName] = 0
            }
            const realId = `${nodeName}_${nodeCounters[nodeName]}`
            nodeCounters[nodeName]++
            idMapping[simpleNode.id] = realId
        })
    }

    // Reset counters for actual inflation
    // OR we could have stored metadata in the first pass.
    // Simpler: Just re-calculate or store in a separate map.
    // Let's preserve the counters by re-initializing them or checking idMapping.
    // PROBLEM: We incremented counters. We need to match the SAME realId in the second pass.
    // Solution: We already built `idMapping`. We can just look up the realId if we reconstruct the simple ID.
    // But `inflateFlow` logic below re-generates realId.
    // Refactor: Let's do a proper single pass but with a pre-pass for IDs.

    // RE-RESET Counters for the main loop
    Object.keys(nodeCounters).forEach(k => nodeCounters[k] = 0);

    // 2. Inflate Nodes
    if (minifiedFlow.nodes && Array.isArray(minifiedFlow.nodes)) {
        minifiedFlow.nodes.forEach((nodeItem, index) => {
            let simpleNode = nodeItem
            // ... (Simple Node normalization logic repeated or just accessible) ...
            if (typeof nodeItem === 'object' && !nodeItem.id) {
                simpleNode = { ...nodeItem, id: nodeItem.id || nodeItem.index || (index + 1) }
            }

            const nodeName = typeMap[simpleNode.typeId] || simpleNode.name || simpleNode.type
            if (!nodeName) return

            // ... (Validation logic) ...
            const componentNode = componentNodes[nodeName]
            if (!componentNode) return

            // Re-generate same Real ID (deterministic because order is same)
            if (!nodeCounters[nodeName] && nodeCounters[nodeName] !== 0) nodeCounters[nodeName] = 0
            const realId = `${nodeName}_${nodeCounters[nodeName]}`
            nodeCounters[nodeName]++

            // ... (Init logic) ...
            const nodeData = initNode(cloneDeep(componentNode), realId)

            if (!nodeData) {
                console.warn(`[AgentflowSimplifier] Failed to init node: ${realId}`)
                return
            }
            if (!nodeData.inputs) nodeData.inputs = {}

            // Fix: Generate IDs for inputParams if they don't exist
            if (nodeData.inputParams && Array.isArray(nodeData.inputParams)) {
                nodeData.inputParams.forEach((param) => {
                    if (!param.id) {
                        param.id = `${realId}-input-${param.name}-${param.type}`
                    }
                })
            }

            // Inflate with Default Data from Type Map
            const defaultEntry = Object.values(nodeDefaults).find(entry => entry.name === nodeName)
            if (defaultEntry && defaultEntry.inputs) {
                nodeData.inputs = { ...defaultEntry.inputs, ...nodeData.inputs }
            }

            // Override with simplified data (STRICT MERGE)
            nodeData.label = simpleNode.label || nodeData.label

            // Handle LLM messages (special case, kept for compatibility)
            if (simpleNode.messages) {
                nodeData.inputs.agentMessages = simpleNode.messages
            }

            // Strict Merge Logic: Check if input exists in component definition
            if (simpleNode.inputs && nodeData.inputParams) {

                // AUTO-DETECT START NODE TYPE
                if (nodeName === 'startAgentflow') {
                    if (simpleNode.inputs.formInputTypes && simpleNode.inputs.formInputTypes.length > 0) {
                        // Only set if not explicitly set by AI (or if AI set it wrong, but let's trust explicit first? No, AI often forgets)
                        // Let's force it if formInputTypes are present, as that's a strong signal.
                        // But if user explicitly said chatInput in inputs... rare.
                        // Let's duplicate the logic: if not set, set it.
                        if (!simpleNode.inputs.startInputType) {
                            nodeData.inputs.startInputType = 'formInput'
                        }
                    }
                }

                // Iterate user inputs
                Object.keys(simpleNode.inputs).forEach((key) => {
                    const mappedKey = findBestMatch(key, nodeData.inputParams)

                    if (mappedKey) {
                        let value = simpleNode.inputs[key]

                        // EXPAND VARIABLES (String inputs only)
                        if (typeof value === 'string') {
                            value = expandVariables(value, idMapping)
                        }

                        // VALUE MATCHING FOR OPTIONS
                        const paramDef = nodeData.inputParams.find((p) => p.name === mappedKey)
                        if (
                            paramDef &&
                            (paramDef.type === 'options' || paramDef.type === 'asyncOptions' || paramDef.type === 'multiOptions')
                        ) {
                            if (paramDef.options && Array.isArray(paramDef.options)) {
                                if (Array.isArray(value)) {
                                    // Handle multi-select values
                                    value = value.map((v) => findBestOptionMatch(v, paramDef.options))
                                } else {
                                    value = findBestOptionMatch(value, paramDef.options)
                                }
                            }
                        }

                        // ARRAY DEEP MAPPING (e.g. agentMessages: [{Role: 'System', ...}] -> [{role: 'system', ...}])
                        if (paramDef && paramDef.type === 'array' && Array.isArray(value) && paramDef.array) {
                            value = value.map(item => {
                                if (typeof item !== 'object' || !item) return item
                                const newItem = {}
                                Object.keys(item).forEach(subKey => {
                                    const subParamDef = findBestMatch(subKey, paramDef.array) // findBestMatch returns NAME
                                    if (subParamDef) {
                                        let subValue = item[subKey]

                                        // Handle Options inside Array
                                        const subDef = paramDef.array.find(p => p.name === subParamDef)
                                        if (subDef && (subDef.type === 'options' || subDef.type === 'asyncOptions')) {
                                            subValue = findBestOptionMatch(subValue, subDef.options)
                                        }

                                        newItem[subParamDef] = subValue
                                    } else {
                                        // Keep original if no match found (or maybe it is already correct)
                                        newItem[subKey] = item[subKey]
                                    }
                                })
                                return newItem
                            })
                        }

                        nodeData.inputs[mappedKey] = value
                    }
                })
            }


            // Layout: Simple Horizontal Layout
            // x = index * 350, y = 100
            const position = { x: index * 350, y: 100 }

            inflatedNodes.push({
                id: realId,
                type: 'agentFlow', // Always agentFlow
                position,
                data: nodeData,
                width: nodeData.width || 200,
                height: nodeData.height || 100
            })
        })
    }

    // 2. Inflate Edges
    if (minifiedFlow.edges && Array.isArray(minifiedFlow.edges)) {
        minifiedFlow.edges.forEach(simpleEdgeStr => {
            // Expected format: "sourceId-targetId" (e.g., "10-20")
            const [sourceSimpleId, targetSimpleId] = simpleEdgeStr.split('-')

            const sourceId = idMapping[sourceSimpleId]
            const targetId = idMapping[targetSimpleId]

            if (!sourceId || !targetId) {
                console.warn(`[AgentflowSimplifier] Invalid edge reference: ${simpleEdgeStr}`)
                return
            }

            const sourceNode = inflatedNodes.find(n => n.id === sourceId)
            const targetNode = inflatedNodes.find(n => n.id === targetId)


            const sourceHandle = `${sourceId}-output-${sourceNode.data.name}`

            const targetHandle = `${targetId}-input-${targetNode.data.name}`

            inflatedEdges.push({
                id: `${sourceId}-${sourceHandle}-${targetId}-${targetHandle}`,
                type: 'agentFlow',
                source: sourceId,
                sourceHandle: sourceHandle,
                target: targetId,
                targetHandle: targetHandle,
                data: {
                    sourceColor: sourceNode.data.color,
                    targetColor: targetNode.data.color
                }
            })
        })
    }

    return {
        nodes: inflatedNodes,
        edges: inflatedEdges
    }
}
