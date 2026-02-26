import { initNode, showHideInputParams } from '@/utils/genericHelper'
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
    let idCounter = 100 // Start dynamic IDs from 100 to avoid conflict with static map

    // 1. Load Static Defaults First
    Object.keys(nodeDefaults).forEach(id => {
        const name = nodeDefaults[id].name
        if (componentNodes[name]) {
            typeMap[id] = name
            reverseMap[name] = id
            const node = componentNodes[name]
            menuItems.push(`${id}: ${node.label} - ${node.description}`)
        }
    })

    // 2. Load Remaining Nodes (Dynamic)
    // Filter for Agent Flows and PrivOS categories
    const agentNodes = Object.values(componentNodes).filter(
        node => (node.category === 'Agent Flows' || node.category === 'PrivOS') && !reverseMap[node.name]
    )

    // Sort to ensure deterministic IDs
    agentNodes.sort((a, b) => a.label.localeCompare(b.label))

    agentNodes.forEach(node => {
        const id = idCounter++
        typeMap[id] = node.name
        reverseMap[node.name] = id
        menuItems.push(`${id}: ${node.label} - ${node.description}`)
    })

    console.log('[Debug] TypeMap Generation:')
    console.log('[Debug] Defaults for 9:', nodeDefaults['9'])
    console.log('[Debug] Defaults for 7:', nodeDefaults['7'])
    console.log('[Debug] Component Node httpAgentflow:', componentNodes['httpAgentflow'] ? 'Found' : 'Missing')
    console.log('[Debug] Generated Map [9]:', typeMap[9])
    console.log('[Debug] Generated Map [7]:', typeMap[7])
    console.log('[Debug] Full TypeMap:', JSON.stringify(typeMap, null, 2))

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

    if (!inputParams || !Array.isArray(inputParams)) return null

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

    if (!options || !Array.isArray(options)) return value

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

    // 2b. $flow.state.variable
    // Format: <p><span class="variable" data-type="mention" data-id="$flow.state.param" data-label="$flow.state.param">{{ $flow.state.param }}</span> </p>
    text = text.replace(/\$flow\.state\.([\w_]+)/g, (match, varName) => {
        const fullVar = `$flow.state.${varName}`
        return `<p><span class="variable" data-type="mention" data-id="${fullVar}" data-label="${fullVar}">{{ ${fullVar} }}</span> </p>`
    })

    // 2c. $output (Current Node Output)
    // Format: <p><span class="variable" data-type="mention" data-id="output" data-label="output">{{ output }}</span> </p>
    text = text.replace(
        /\$output/g,
        `<p><span class="variable" data-type="mention" data-id="output" data-label="output">{{ output }}</span> </p>`
    )

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
            // Support both "id" and "index" fields from LLM
            const simpleId = simpleNode.id || simpleNode.index || (index + 1)
            idMapping[simpleId] = realId
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



            // Fix: Normalize inputParams (Object -> Array) if loaded from JSON definition with 'parameters' object
            if (nodeData.inputParams && !Array.isArray(nodeData.inputParams) && typeof nodeData.inputParams === 'object') {
                // It might be the 'parameters' object directly or wrapped.
                // If it's the raw object from JSON 'parameters': { "arg1": {...}, "arg2": {...} }
                // We convert to array: [{name: "arg1", ...}, {name: "arg2", ...}]
                nodeData.inputParams = Object.keys(nodeData.inputParams).map(k => {
                    const val = nodeData.inputParams[k]
                    // Ensure it has a name
                    return { name: k, ...val }
                })
            }

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
                // Sort keys to ensure controlling params (like startInputType) are processed first
                const sortedKeys = Object.keys(simpleNode.inputs).sort((a, b) => {
                    const aKey = findBestMatch(a, nodeData.inputParams) || a
                    const bKey = findBestMatch(b, nodeData.inputParams) || b
                    if (aKey === 'startInputType') return -1
                    if (bKey === 'startInputType') return 1
                    return 0
                })

                // 3.1 Handle Simplified Properties for Agent Nodes
                if (nodeName === 'agentAgentflow') {
                    let modelName = simpleNode.inputs.agentModel

                    // Handle case where agentModel is an object (LLM hallucination or complex structure)
                    if (modelName && typeof modelName === 'object') {
                        modelName = modelName.modelName || modelName.name || modelName.label || 'gpt-4o-mini'
                    }

                    // Default Model if missing
                    if (!modelName) {
                        modelName = 'gpt-4o-mini'
                        nodeData.inputs.agentModel = 'chatOpenAI'
                        // We also need to set the config default later if needed
                    }

                    // Ensure modelName is a string before checking startsWith
                    if (typeof modelName === 'string') {
                        if (modelName.startsWith('gpt')) {
                            nodeData.inputs.agentModel = 'chatOpenAI'
                            if (!nodeData.inputs.agentModelConfig) nodeData.inputs.agentModelConfig = {}
                            nodeData.inputs.agentModelConfig.modelName = modelName
                            nodeData.inputs.agentModelConfig.temperature = 0.7
                        } else if (modelName.startsWith('claude')) {
                            nodeData.inputs.agentModel = 'chatAnthropic'
                            if (!nodeData.inputs.agentModelConfig) nodeData.inputs.agentModelConfig = {}
                            nodeData.inputs.agentModelConfig.modelName = modelName
                        } else if (modelName.startsWith('gemini')) {
                            nodeData.inputs.agentModel = 'chatGoogleGenerativeAI'
                            if (!nodeData.inputs.agentModelConfig) nodeData.inputs.agentModelConfig = {}
                            nodeData.inputs.agentModelConfig.modelName = modelName
                        } else {
                            // Fallback or if user correctly provided 'chatOpenAI' etc.
                            // If it's not a known provider standard name, assume it's a provider?
                            // But usually users type 'gpt-4'
                            // Let's assume if it doesn't match known providers, we trust it or default to OpenAI.
                            nodeData.inputs.agentModel = 'chatOpenAI'
                            // But keep the value as modelName if it's not "chatOpenAI"
                            if (modelName !== 'chatOpenAI') {
                                if (!nodeData.inputs.agentModelConfig) nodeData.inputs.agentModelConfig = {}
                                nodeData.inputs.agentModelConfig.modelName = modelName
                            }
                        }
                    }

                    // Handle agentSystemPrompt -> agentMessages
                    if (simpleNode.inputs.agentSystemPrompt) {
                        const sysPrompt = expandVariables(simpleNode.inputs.agentSystemPrompt, idMapping)
                        if (!nodeData.inputs.agentMessages) nodeData.inputs.agentMessages = []

                        // Check if system message already exists
                        const hasSystem = nodeData.inputs.agentMessages.some(m => m.role === 'system')
                        if (!hasSystem) {
                            nodeData.inputs.agentMessages.unshift({
                                role: 'system',
                                content: sysPrompt
                            })
                        }
                    }
                }

                // 4. Map Inputs from Simplified to Real
                sortedKeys.forEach((key) => {
                    let value = simpleNode.inputs[key]
                    if (value === undefined || value === null) return

                    // Skip already handled simplified keys
                    if (key === 'agentSystemPrompt') return

                    // EXPAND VARIABLES (Top Level)
                    if (typeof value === 'string') {
                        value = expandVariables(value, idMapping)
                    }

                    const mappedKey = findBestMatch(key, nodeData.inputParams)

                    if (mappedKey) {
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
                        if (paramDef && (paramDef.type === 'array' || paramDef.type === 'datagrid')) {

                            // 1. Handle Stringified JSON Input
                            if (typeof value === 'string') {
                                try {
                                    const parsedOptions = JSON.parse(value)
                                    value = parsedOptions
                                } catch (e) {
                                    // Not JSON, leave as string
                                }
                            }

                            // 2. Handle Object -> Array mapping (for key/value pairs like headers)
                            const isKeyValueArray = paramDef.array && paramDef.array.some(p => p.name === 'key') && paramDef.array.some(p => p.name === 'value')

                            if (typeof value === 'object' && value !== null && !Array.isArray(value) && isKeyValueArray) {
                                // Convert { "Content-Type": "application/json" } -> [ { key: "Content-Type", value: "application/json" } ]
                                try {
                                    value = Object.keys(value).map(k => {
                                        let val = value[k]
                                        if (typeof val === 'object') val = JSON.stringify(val) // stringify nested objects if needed
                                        return {
                                            key: k,
                                            value: val
                                        }
                                    })
                                } catch (e) {
                                    console.error('Error converting object to key-value array:', e)
                                }
                            }

                            if (Array.isArray(value) && paramDef.array) {
                                value = value.map(item => {
                                    // SPECIAL CASE: Handle simple string array for 'addOptions'
                                    // if item is string and array definition has only 1 field of type string (like 'option')
                                    if (typeof item === 'string' && mappedKey === 'addOptions' && paramDef.array.length === 1) {
                                        const singleField = paramDef.array[0]
                                        return { [singleField.name]: item }
                                    }

                                    if (typeof item !== 'object' || !item) return item
                                    const newItem = {}
                                    Object.keys(item).forEach(subKey => {
                                        // Normalize sub-parameters (Handle parameters object vs array list)
                                        let subParams = paramDef.array
                                        if (!subParams && paramDef.parameters) {
                                            subParams = Object.keys(paramDef.parameters).map(k => ({
                                                name: k,
                                                ...paramDef.parameters[k]
                                            }))
                                        }

                                        // Debug logging removed per request
                                        // console.log(`[Simplifier] Processing array item key: ${subKey}`)

                                        const subParamDef = findBestMatch(subKey, subParams) // findBestMatch returns NAME

                                        // if (!subParamDef) console.log(`[Simplifier] No match found for ${subKey}`)

                                        if (subParamDef) {
                                            let subValue = item[subKey]

                                            // Handle Options inside Array
                                            // Ensure subDef lookup uses the normalized subParams
                                            const subDef = subParams.find(p => p.name === subParamDef)
                                            if (subDef && (subDef.type === 'options' || subDef.type === 'asyncOptions') && Array.isArray(subDef.options)) {
                                                subValue = findBestOptionMatch(subValue, subDef.options)
                                            }

                                            // EXPAND VARIABLES (Nested String inputs)
                                            if (typeof subValue === 'string') {
                                                subValue = expandVariables(subValue, idMapping)
                                            }

                                            // RECURSIVE ARRAY/OBJECT MAPPING FOR SUB-PROPERTIES (Fixed for addOptions)
                                            // Check if this sub-property is an array that needs transformation (like addOptions)
                                            if (subDef && subDef.type === 'array' && Array.isArray(subValue) && subDef.array) {
                                                subValue = subValue.map(subItem => {
                                                    // 1. Transform String Array -> Object Array (["A"] -> [{option: "A"}])
                                                    if (typeof subItem === 'string' && subDef.array.length === 1) {
                                                        const singleField = subDef.array[0]
                                                        return { [singleField.name]: subItem }
                                                    }
                                                    // 2. Already object, return as is
                                                    return subItem
                                                })
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

                        } // End of Array/Datagrid Logic



                        nodeData.inputs[mappedKey] = value
                    }
                })
            }


            // Layout: Simple Horizontal Layout
            // x = index * 200, y = alternating 0 and -200
            const alternatingY = index % 2 === 0 ? 0 : -200
            const position = { x: index * 200, y: alternatingY }

            // VISIBILITY CHECK
            // Use core helper to ensure consistent behavior
            nodeData.inputParams = showHideInputParams(nodeData)

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

    // Final Log of Mapped Flow
    console.log('[AgentflowSimplifier] Inflated Nodes:', inflatedNodes)

    return {
        nodes: inflatedNodes,
        edges: inflatedEdges
    }
}
// ============================================================================
// HELPER: Deflate Variables (Reverse of expandVariables)
// Converts HTML variable spans back to shorthand syntax
// ============================================================================
const deflateVariables = (text, reverseIdMapping) => {
    if (typeof text !== 'string') return text

    // Regex to match variable spans: <p><span ... data-id="..." ...>{{ ... }}</span> </p>
    // We only care about the data-id or the inner text, but data-id is most reliable
    const variableRegex = /<p><span class="variable" data-type="mention" data-id="([^"]+)"[^>]*>.*?<\/span> <\/p>/g

    return text.replace(variableRegex, (match, id) => {
        // 1. $question
        if (id === 'question') return '$question'

        // 2. $output
        if (id === 'output') return '$output'

        // 3. $form.variable
        if (id.startsWith('$form.')) return id // Already in correct format

        // 4. $flow.state.variable
        if (id.startsWith('$flow.state.')) return id // Already in correct format

        // 5. Node IDs -> $1, $2
        // We need reverse mapping from Real ID to Simple ID
        if (reverseIdMapping && reverseIdMapping[id]) {
            return `$${reverseIdMapping[id]}`
        }

        // Fallback: keep original ID if no mapping (though this shouldn't happen in valid flows)
        return `$${id}`
    })
}

// ============================================================================
// HELPER: Deflate Flow
// Converts full Flowise { nodes, edges } -> simplified { nodes, edges }
// ============================================================================
export const deflateFlow = (nodes, edges, typeMap, reverseTypeMap) => {
    const minifiedNodes = []
    const minifiedEdges = []
    const reverseIdMapping = {} // Map Real ID (agentAgentflow_0) -> Simple ID (1, 2...)


    nodes.forEach((node, index) => {
        const simpleId = index + 1
        reverseIdMapping[node.id] = simpleId
    })

    // 2. Deflate Nodes
    nodes.forEach((node) => {
        const typeId = reverseTypeMap[node.data.name]
        if (!typeId) return // Skip unknown nodes

        const simpleId = reverseIdMapping[node.id]

        const simpleNode = {
            id: simpleId,
            typeId: parseInt(typeId), // Type ID from map
            label: node.data.label,
            inputs: {}
        }

        // Deflate Inputs
        if (node.data.inputs) {
            Object.keys(node.data.inputs).forEach((key) => {
                let value = node.data.inputs[key]

                // Skip internal/system fields
                if (key === 'inputParams' || key === 'outputAnchors' || key === 'id') return
                if (value === undefined || value === null || value === '') return

                // Deflate Variables in Strings
                if (typeof value === 'string') {
                    value = deflateVariables(value, reverseIdMapping)
                }

                // Deflate Array/Object Variables
                if (Array.isArray(value)) {
                    value = value.map(item => {
                        if (typeof item === 'string') return deflateVariables(item, reverseIdMapping)
                        if (typeof item === 'object' && item !== null) {
                            const newItem = { ...item }
                            Object.keys(newItem).forEach(subKey => {
                                if (typeof newItem[subKey] === 'string') {
                                    newItem[subKey] = deflateVariables(newItem[subKey], reverseIdMapping)
                                }
                            })
                            // Special Case: agentMessages (role/content)
                            // If role is system, we might map back to agentSystemPrompt?
                            // But usually we just keep it as agentMessages structure in simplified flow too,
                            // UNLESS we want to strictly map back to 'agentSystemPrompt' for UX.
                            // For now, allow raw inputs.
                            return newItem
                        }
                        return item
                    })
                }

                simpleNode.inputs[key] = value
            })
        }

        // Special backward compatibility: Extract system prompt
        if (simpleNode.inputs.agentMessages) {
            const systemMsgIndex = simpleNode.inputs.agentMessages.findIndex(m => m.role === 'system')
            if (systemMsgIndex >= 0) {
                const systemMsg = simpleNode.inputs.agentMessages[systemMsgIndex]
                simpleNode.inputs.agentSystemPrompt = systemMsg.content // Already deflated above
                // Remove from messages array to avoid duplication?
                // The simplifier re-adds it. So yes, remove it to keep it clean.
                simpleNode.inputs.agentMessages.splice(systemMsgIndex, 1)
                if (simpleNode.inputs.agentMessages.length === 0) {
                    delete simpleNode.inputs.agentMessages
                }
            }
        }

        // Remove startInputType inferred default
        if (simpleNode.inputs.startInputType === 'formInput' && simpleNode.inputs.formInputTypes) {
            // Optional: clean it up if implicit
        }

        minifiedNodes.push(simpleNode)
    })

    // 3. Deflate Edges
    edges.forEach((edge) => {
        const sourceSimple = reverseIdMapping[edge.source]
        const targetSimple = reverseIdMapping[edge.target]
        if (sourceSimple && targetSimple) {
            minifiedEdges.push(`${sourceSimple}-${targetSimple}`)
        }
    })

    return {
        nodes: minifiedNodes,
        edges: minifiedEdges
    }
}
