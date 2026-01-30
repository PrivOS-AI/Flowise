
/**
 * Simple auto-layout for React Flow nodes/edges without external dependencies.
 * Uses a basic layered approach (Left-to-Right).
 * 
 * @param {Array} nodes 
 * @param {Array} edges 
 * @param {Object} options { direction: 'LR' | 'TB', rankSep: 250, nodeSep: 150 }
 * @returns {Object} { nodes: [], edges: [] } with updated positions
 */
export const autoLayout = (nodes, edges, options = {}) => {
    const direction = options.direction || 'LR' // LR = Left-to-Right, TB = Top-to-Bottom
    const rankSep = options.rankSep || (direction === 'LR' ? 350 : 200)
    const nodeSep = options.nodeSep || (direction === 'LR' ? 100 : 250)

    // 1. Build Adjacency List & Calculate In-Degrees
    const adj = {}
    const inDegree = {}
    const nodeMap = {}

    nodes.forEach(node => {
        adj[node.id] = []
        inDegree[node.id] = 0
        nodeMap[node.id] = node
    })

    edges.forEach(edge => {
        if (adj[edge.source]) {
            adj[edge.source].push(edge.target)
            // Ensure target exists in map (safeguard)
            if (inDegree[edge.target] !== undefined) {
                inDegree[edge.target]++
            }
        }
    })

    // 2. Assign Levels (Ranks) using BFS (Topological Sort-ish)
    const levels = {}
    const queue = []

    // Find roots (zero in-degree)
    nodes.forEach(node => {
        if (inDegree[node.id] === 0) {
            levels[node.id] = 0
            queue.push(node.id)
        }
    })

    // If no roots (cycle?), pick first as root
    if (queue.length === 0 && nodes.length > 0) {
        levels[nodes[0].id] = 0
        queue.push(nodes[0].id)
    }

    const visited = new Set(queue)

    while (queue.length > 0) {
        const u = queue.shift()
        const currentLevel = levels[u]

        if (adj[u]) {
            adj[u].forEach(v => {
                if (!visited.has(v)) {
                    visited.add(v)
                    levels[v] = currentLevel + 1
                    queue.push(v)
                }
            })
        }
    }

    // Handle disconnected components / unvisited nodes
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            levels[node.id] = 0 // Default to level 0 or separate?
        }
    })

    // 3. Group by Level
    const nodesByLevel = {}
    Object.entries(levels).forEach(([nodeId, level]) => {
        if (!nodesByLevel[level]) nodesByLevel[level] = []
        nodesByLevel[level].push(nodeId)
    })

    // 4. Assign Coordinates
    const newNodes = nodes.map(node => {
        const level = levels[node.id] || 0
        const indexInLevel = nodesByLevel[level].indexOf(node.id)
        const levelSize = nodesByLevel[level].length

        let x, y

        if (direction === 'LR') {
            x = level * rankSep
            // Center nodes vertically relative to the "center" of the diagram roughly
            // or just stack them. Let's stack them centered.
            const totalHeight = (levelSize - 1) * nodeSep
            const startY = -totalHeight / 2
            y = startY + indexInLevel * nodeSep
        } else {
            y = level * rankSep
            const totalWidth = (levelSize - 1) * nodeSep
            const startX = -totalWidth / 2
            x = startX + indexInLevel * nodeSep
        }

        return {
            ...node,
            position: { x, y }
        }
    })

    return { nodes: newNodes, edges }
}
