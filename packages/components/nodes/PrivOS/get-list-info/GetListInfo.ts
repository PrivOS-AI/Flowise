import {
    getCredentialData,
    ICommonObject,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IPrivosCredential,
    processTemplateVariables,
    secureAxiosRequest
} from '../../../src'
import { updateFlowState } from '../../agentflow/utils'
import { PRIVOS_ENDPOINTS } from '../constants'
import { PrivosErrorHandler } from '../utils'

const ALL_FIELDS = [
    { label: 'Stages', name: 'stages', description: 'Stages info' },
    { label: 'Members Info', name: 'membersInfo', description: 'Information about members' },
    { label: 'Assignee', name: 'assignee', description: 'Assignee information' },
    { label: 'Items Info', name: 'itemsInfo', description: 'Information about items in the list' }
]

class GetListInfo_Privos implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    color: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]
    output?: INodeOutputsValue[] | undefined

    constructor() {
        this.label = 'Get List Info'
        this.name = 'getListInfoPrivos'
        this.version = 1.0
        this.type = 'ListProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch list info and select custom fields from Privos API'
        this.icon = 'privos.svg'
        this.color = '#4318FF'
        this.baseClasses = [this.type]
        this.credential = {
            label: 'Privos API Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['privosApi']
        }
        this.inputs = [
            {
                label: 'List ID',
                name: 'listId',
                type: 'string',
                acceptVariable: true
            },
            {
                label: 'Custom Data Fields',
                name: 'selectedDataFields',
                type: 'asyncMultiOptions',
                loadMethod: 'listCustomDataFields',
                default: [JSON.stringify(ALL_FIELDS.map((f) => f.name))]
            },
            {
                label: 'Output Structure',
                name: 'outputStructure',
                type: 'options',
                options: [
                    { label: 'Array (List)', name: 'array' },
                    { label: 'Object (Single)', name: 'object' }
                ],
                default: 'object'
            },
            {
                label: 'Update Flow State',
                name: 'updateFLowState',
                description: 'Update runtime state during the execution of the workflow',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: 'Key',
                        name: 'key',
                        type: 'asyncOptions',
                        loadMethod: 'listRuntimeStateKeys',
                        freeSolo: true
                    },
                    {
                        label: 'Value',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true,
                        acceptNodeOutputAsVariable: true
                    }
                ]
            }
        ]
        this.output = [
            {
                label: 'Result Data',
                name: 'result',
                baseClasses: [this.type, 'string', 'object']
            }
        ]
    }

    private async fetchPrivosData(baseUrl: string, apiKey: string, listId: string) {
        const listRes = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.LISTS}/${listId}`,
            headers: { 'X-API-KEY': apiKey }
        })
        return listRes.data
    }

    //@ts-ignore
    loadMethods = {
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        },
        listCustomDataFields(_: INodeData, options: ICommonObject): INodeOptionsValue[] {
            const result = [
                {
                    label: '✓ Select All Fields',
                    name: JSON.stringify(ALL_FIELDS.map((f: any) => f.name)),
                    description: 'Includes all custom data fields'
                },
                ...ALL_FIELDS
            ]

            return result
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const { listId, outputStructure, selectedDataFields, updateFLowState } = nodeData.inputs as ICommonObject
        if (!listId) throw new Error('Item ID is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const listInfo = await this.fetchPrivosData(baseUrl, apiKey, listId)

            const selectedFields = new Set(JSON.parse(selectedDataFields as string))
            const result: any = {
                listId: listInfo?.list?._id,
                ...(selectedFields?.has('stages') && {
                    stages: this.handleStageDataField(listInfo)
                }),
                ...(selectedFields?.has('assignee') && {
                    assigneeFieldId: this.handleAssignFieldId(listInfo)
                }),
                ...(selectedFields?.has('membersInfo') && {
                    membersInfo: await this.handleMembersInfoDataField(baseUrl, apiKey, listInfo?.list?.roomId)
                }),
                ...(selectedFields?.has('itemsInfo') && {
                    itemsInfo: await this.handleItemsInfoDataField(
                        listInfo?.items,
                        this.handleAssignFieldId(listInfo),
                        listInfo?.list?.roomId
                    )
                })
            }

            const finalOutput = outputStructure === 'object' ? result : [result]

            // Update flow state if needed
            let newState = { ...state }
            if (updateFLowState && Array.isArray(updateFLowState) && updateFLowState.length > 0) {
                newState = updateFlowState(state, updateFLowState)
            }
            newState = processTemplateVariables(newState, finalOutput)

            return {
                itemResult: finalOutput,
                id: nodeData.id,
                name: this.name,
                input: { listId, selectedDataFields },
                output: { content: JSON.stringify(finalOutput, null, 2) },
                state: newState
            }
        } catch (error) {
            return PrivosErrorHandler.wrapError(this.name, error, nodeData.id, state)
        }
    }

    private handleStageDataField(listInfo: any) {
        return (listInfo?.stages || []).map((s: any) => ({
            stageId: s?._id ?? null,
            name: s?.name ?? '',
            color: s?.color ?? '',
            order: s?.order ?? 0
        }))
    }

    private handleAssignFieldId(listInfo: any) {
        let assigneeFieldId = []
        const fieldDefinitions = listInfo?.list?.fieldDefinitions || []

        // Method 1: Find USER type field in fieldDefinitions
        if (Array.isArray(fieldDefinitions) && fieldDefinitions.length > 0) {
            const userFields = fieldDefinitions
                .filter((f) => f?.type === 'USER')
                .map((f) => f?._id)
                .filter(Boolean)

            assigneeFieldId.push(...userFields)
        }

        // Method 2: If fieldDefinitions empty, detect from items' customFields
        if (assigneeFieldId.length === 0 && listInfo?.items && listInfo.items.length > 0) {
            for (const item of listInfo.items) {
                const customFields = item?.customFields || []
                for (const cf of customFields) {
                    if (Array.isArray(cf.value) && cf.value.length > 0) {
                        const firstValue = cf.value[0]
                        if (firstValue && firstValue._id && (firstValue.username || firstValue.name)) {
                            assigneeFieldId.push(cf.fieldId)
                            break
                        }
                    }
                }
                if (assigneeFieldId.length > 0) break
            }
        }

        return assigneeFieldId
    }

    private async handleMembersInfoDataField(baseUrl: string, apiKey: string, roomId?: string) {
        if (!roomId) return []

        try {
            const membersRes = await secureAxiosRequest({
                url: `${baseUrl}${PRIVOS_ENDPOINTS.ROOM_MEMBERS}?roomId=${encodeURIComponent(roomId)}`,
                headers: { 'X-API-KEY': apiKey }
            })

            const membersInfo = (membersRes.data?.users || []).map((u: any) => ({
                userid: u._id,
                username: u.username || null,
                name: u.name || null,
                position: u.position?.name || null,
                skills: Array.isArray(u.skills) ? u.skills.map((s: any) => s?.name) : []
            }))

            return membersInfo
        } catch (error) {
            console.error('Error fetching members info:', error?.message)
            return []
        }
    }

    private async handleItemsInfoDataField(items: any[], assigneeFieldIds: string[], roomId?: string): Promise<any[]> {
        if (!roomId) return []

        try {
            return (items || []).map((item: any) => {
                const customFields = item?.customFields || []

                const assignees = Array.isArray(assigneeFieldIds)
                    ? customFields
                          .filter((field: any) => assigneeFieldIds.includes(field?.fieldId))
                          .flatMap((field: any) => (Array.isArray(field?.value) ? field.value : []))
                          .map((user: any) => ({
                              username: user?.username || '',
                              name: user?.name || ''
                          }))
                    : []

                return {
                    itemId: item?._id ?? null,
                    name: item?.name ?? '',
                    description: item?.description ?? '',
                    stageId: item?.stageId ?? null,
                    assignees
                }
            })
        } catch (error) {
            console.error('Error fetching items info:', error?.message)
            return []
        }
    }
}

module.exports = { nodeClass: GetListInfo_Privos }
