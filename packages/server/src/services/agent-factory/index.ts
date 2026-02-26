const importPlugin = async (data: any) => {
    // Mock implementation
    console.log('[AgentFactory] Mock importPlugin called:', data)
    return {
        success: true,
        message: 'Plugin imported successfully (Mock)',
        plugin: {
            id: 'mock-plugin-id',
            name: 'Mock Plugin',
            type: 'skill',
            description: 'This is a mock plugin imported via AgentFactory',
            sourcePath: data.source || '/tmp/mock-plugin',
            storageType: 'local',
            metadata: {}
        }
    }
}

const listPlugins = async (type?: string) => {
    // Mock implementation
    console.log('[AgentFactory] Mock listPlugins called, type:', type)
    return {
        plugins: [
            {
                id: 'mock-plugin',
                name: 'Mock Plugin',
                type: 'skill',
                description: 'Pre-existing mock plugin',
                sourcePath: '/tmp/mock-plugin',
                storageType: 'local',
                metadata: {}
            }
        ]
    }
}

const discoverPlugins = async (paths: string[]) => {
    console.log('[AgentFactory] Mock discoverPlugins called:', paths)
    return {
        success: true,
        plugins: paths.map((p, i) => ({
            id: `discovered-${i}`,
            name: `Discovered Plugin ${i}`,
            type: 'skill',
            description: `Plugin discovered at ${p}`,
            sourcePath: p,
            storageType: 'local',
            metadata: {}
        }))
    }
}

const uploadPlugin = async (formData: any) => {
    console.log('[AgentFactory] Mock uploadPlugin called')
    return {
        success: true,
        message: 'Upload successful (Mock)',
        sessionId: 'mock-session-id'
    }
}

const getPlugin = async (id: string) => {
    return {
        id,
        name: 'Mock Plugin',
        type: 'skill',
        files: []
    }
}

const deletePlugin = async (id: string) => {
    return { success: true }
}

const getFileContent = async (path: string) => {
    return { content: 'Mock content' }
}

const listFiles = async (sourcePath: string) => {
    return { files: [] }
}

const getDependencies = async (sourcePath: string) => {
    return { dependencies: [] }
}

export default {
    importPlugin,
    listPlugins,
    discoverPlugins,
    uploadPlugin,
    getPlugin,
    deletePlugin,
    getFileContent,
    listFiles,
    getDependencies
}
