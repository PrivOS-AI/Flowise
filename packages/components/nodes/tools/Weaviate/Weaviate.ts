import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client'

// Helper to check if in development mode
const isDev = process.env.NODE_ENV === 'development'

class Weaviate_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'Weaviate Tool'
        this.name = 'weaviateTool'
        this.version = 1.0
        this.type = 'WeaviateTool'
        this.icon = 'weaviate.png'
        this.category = 'Tools'
        this.description = 'Interact with Weaviate to search for information'
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['weaviateApi'],
            optional: true
        }
        this.inputs = [
            {
                label: 'Weaviate Scheme',
                name: 'weaviateScheme',
                type: 'options',
                default: 'https',
                options: [
                    {
                        label: 'https',
                        name: 'https'
                    },
                    {
                        label: 'http',
                        name: 'http'
                    }
                ]
            },
            {
                label: 'Weaviate Host',
                name: 'weaviateHost',
                type: 'string',
                placeholder: 'localhost:8080',
                acceptVariable: true
            },
            {
                label: 'Weaviate Index',
                name: 'weaviateIndex',
                type: 'string',
                placeholder: 'Test',
                acceptVariable: true
            },
            {
                label: 'Weaviate Text Key',
                name: 'weaviateTextKey',
                type: 'string',
                placeholder: 'text',
                optional: true,
                additionalParams: true,
                acceptVariable: true
            },
            {
                label: 'Weaviate Metadata Keys',
                name: 'weaviateMetadataKeys',
                type: 'string',
                rows: 4,
                placeholder: `["foo"]`,
                optional: true,
                additionalParams: true,
                acceptVariable: true
            },
            {
                label: 'Weaviate Search Filter',
                name: 'weaviateFilter',
                type: 'json',
                additionalParams: true,
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Output Fields',
                name: 'fields',
                type: 'string',
                description: 'Comma separated fields to return',
                placeholder: 'title, content',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Top K',
                name: 'topK',
                description: 'Number of top results to fetch. Default to 5',
                placeholder: '5',
                type: 'number',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Search Method',
                name: 'searchMethod',
                type: 'options',
                default: 'Similarity',
                options: [
                    {
                        label: 'Similarity',
                        name: 'Similarity'
                    },
                    {
                        label: 'Hybrid',
                        name: 'Hybrid'
                    }
                ]
            },
            {
                label: 'Alpha (Hybrid)',
                name: 'hybridAlpha',
                type: 'number',
                description: 'Weighting for hybrid search (0 = pure keyword, 1 = pure vector). Default 0.5',
                default: 0.5,
                optional: true,
                additionalParams: true,
                acceptVariable: true
            },
            {
                label: 'Additional Headers',
                name: 'additionalHeaders',
                type: 'json',
                description:
                    'Additional HTTP headers (e.g., {"X-OpenAI-Api-Key": "sk-..."}). Weaviate will use collection\'s configured vectorizer.',
                additionalParams: true,
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Tool Description',
                name: 'toolDescription',
                type: 'string',
                description: 'Description of what this tool does, to help the LLM know when to use it',
                default: 'Useful for searching information in Weaviate database',
                rows: 3,
                acceptVariable: true
            }
        ]
        this.baseClasses = [this.type, 'Tool', 'StructuredTool', 'Runnable']
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const weaviateScheme = nodeData.inputs?.weaviateScheme as string
        const weaviateHost = nodeData.inputs?.weaviateHost as string
        const weaviateIndex = nodeData.inputs?.weaviateIndex as string
        const weaviateTextKey = nodeData.inputs?.weaviateTextKey as string
        const weaviateMetadataKeys = nodeData.inputs?.weaviateMetadataKeys as string
        const fields = nodeData.inputs?.fields as string
        const topK = nodeData.inputs?.topK as string
        const toolDescription = nodeData.inputs?.toolDescription as string
        const searchMethod = nodeData.inputs?.searchMethod as string
        const hybridAlpha = nodeData.inputs?.hybridAlpha as string
        const additionalHeaders = nodeData.inputs?.additionalHeaders
        let weaviateFilter = nodeData.inputs?.weaviateFilter

        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const weaviateApiKey = getCredentialParam('weaviateApiKey', credentialData, nodeData)

        const clientConfig: any = {
            scheme: weaviateScheme,
            host: weaviateHost
        }

        if (weaviateApiKey) clientConfig.apiKey = new ApiKey(weaviateApiKey)

        if (additionalHeaders) {
            try {
                if (typeof additionalHeaders === 'string') {
                    clientConfig.headers = JSON.parse(additionalHeaders)
                } else {
                    clientConfig.headers = additionalHeaders
                }
            } catch (e) {
                if (isDev) console.error('[Weaviate Tool] Failed to parse additionalHeaders:', e)
            }
        }

        const client: WeaviateClient = weaviate.client(clientConfig)

        let filter: any
        if (weaviateFilter) {
            if (typeof weaviateFilter === 'string') {
                try {
                    filter = JSON.parse(weaviateFilter)
                } catch {
                    // ignore
                }
            } else {
                filter = weaviateFilter
            }
        }

        // Combine default description with user's custom description
        const defaultDescription = 'Useful for retrieving relevant information from provided documents based on user queries'
        const finalDescription = toolDescription ? `${defaultDescription}. ${toolDescription}` : defaultDescription

        return new DynamicStructuredTool({
            name: 'weaviate_search',
            description: finalDescription,
            schema: z.object({
                query: z
                    .array(z.string())
                    .describe('List of 2 questions to retrieve information from documents. Example: ["question1", "question2"]')
            }),
            func: async (input: any) => {
                const { query } = input

                // Format input queries - split by pipe (|) for multiple queries
                let queries: string[] = []
                if (Array.isArray(query)) {
                    queries = query
                } else {
                    // Split by pipe (|) first, then by newline as fallback
                    if (query.includes('|')) {
                        queries = query
                            .split('|')
                            .map((q: string) => q.trim())
                            .filter((q: string) => q !== '')
                    } else {
                        queries = query
                            .split('\n')
                            .map((q: string) => q.trim())
                            .filter((q: string) => q !== '')
                    }
                }
                try {
                    const executeSearch = async (singleQuery: string) => {
                        // Clean collection name - remove wildcards and special chars
                        const cleanIndex = weaviateIndex.replace(/^\*+|\*+$/g, '').replace(/^\/+|\/+$/g, '')

                        // Helper function to clean field names
                        const cleanFieldName = (fieldName: string): string => {
                            return fieldName.replace(/^\*+|\*+$/g, '').replace(/^\/+|\/+$/g, '')
                        }

                        // Determine which fields to return
                        const returnFields: string[] = []
                        if (fields) {
                            returnFields.push(...fields.split(',').map((f) => cleanFieldName(f.trim())))
                        } else {
                            // Construct fields from textKey and metadataKeys
                            if (weaviateTextKey) returnFields.push(cleanFieldName(weaviateTextKey))
                            if (weaviateMetadataKeys) {
                                try {
                                    const metas = JSON.parse(weaviateMetadataKeys.replace(/\s/g, ''))
                                    if (Array.isArray(metas)) {
                                        returnFields.push(...metas.map((m: string) => cleanFieldName(m)))
                                    }
                                } catch (e) {
                                    // ignore
                                }
                            }
                        }

                        // Always return metadata (id, score, distance)
                        // In v3: _additional { id certainty distance }
                        // For compatibility, we'll request them in the _additional block usually,
                        // but weaviate-ts-client (v2) builder handles fields separately.
                        // We will construct the fields string for GraphQL

                        let builder = client.graphql.get().withClassName(cleanIndex)

                        if (returnFields.length > 0) {
                            builder = builder.withFields(returnFields.join(' ') + ' _additional { id distance certainty }')
                        } else {
                            // If no fields specified, at least ask for _additional
                            builder = builder.withFields('_additional { id distance certainty }')
                        }

                        if (searchMethod === 'Hybrid') {
                            const alpha = hybridAlpha ? parseFloat(hybridAlpha) : 0.5
                            builder = builder.withHybrid({
                                query: singleQuery,
                                alpha: alpha
                            })
                        } else {
                            // Similarity (NearText)
                            builder = builder.withNearText({
                                concepts: [singleQuery]
                            })
                        }

                        // Apply limit
                        const limit = parseInt(topK) || 5
                        builder = builder.withLimit(limit)

                        // Apply filter
                        if (filter) {
                            builder = builder.withWhere(filter)
                        }

                        const result = await builder.do()

                        // Parse result
                        const objects = result.data?.Get?.[cleanIndex]

                        if (!objects) return []

                        return objects.map((obj: any) => {
                            const { _additional, ...rest } = obj
                            return {
                                id: _additional?.id,
                                properties: rest,
                                score: _additional?.certainty ?? _additional?.distance // Normalize score/distance
                            }
                        })
                    }

                    // Execute searches in parallel
                    const resultsArray = await Promise.all(queries.map((q: string) => executeSearch(q)))

                    // Flatten and deduplicate results by ID
                    const allResults = resultsArray.flat()
                    const uniqueResultsMap = new Map()

                    allResults.forEach((item: any) => {
                        if (item.id && !uniqueResultsMap.has(item.id)) {
                            uniqueResultsMap.set(item.id, item)
                        }
                    })

                    const finalResults = Array.from(uniqueResultsMap.values())

                    const output = {
                        query: query,
                        collection: weaviateIndex,
                        total_results: finalResults.length,
                        results: finalResults
                    }

                    return JSON.stringify(output, null, 2)
                } catch (error: any) {
                    return `Error searching Weaviate: ${error.message}`
                }
            }
        })
    }
}

module.exports = { nodeClass: Weaviate_Tools }
