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
import { mapCustomFields, PrivosErrorHandler } from '../utils'

const ALL_FIELDS = [
    { label: 'Custom Fields', name: 'customFields', description: 'All custom fields' },
    { label: 'Stages', name: 'stages', description: 'Stages info' },
    { label: 'Members Info', name: 'membersInfo', description: 'Information about members' },
    { label: 'Assignee', name: 'assignee', description: 'Assignee information' }
]

class GetItemInfo_Privos implements INode {
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
        this.label = 'Get Item Info'
        this.name = 'getItemInfoPrivos'
        this.version = 1.0
        this.type = 'ItemProcessor'
        this.category = 'PrivOS'
        this.description = 'Fetch item info and select custom fields from Privos API'
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
                label: 'Item ID',
                name: 'itemId',
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

    private async fetchPrivosData(baseUrl: string, apiKey: string, itemId: string) {
        const headers = { 'X-API-KEY': apiKey }

        // 1. Fetch Item Info
        const itemRes = await secureAxiosRequest({
            url: `${baseUrl}${PRIVOS_ENDPOINTS.ITEMS_INFO}`,
            headers,
            params: { itemId }
        })
        const item = itemRes.data.item

        // 2. Fetch List Definitions (if listId exists)
        let listInfo = null
        if (item?.listId) {
            console.log('Fetching list info for listId:', item.listId)
            const listRes = await secureAxiosRequest({
                url: `${baseUrl}${PRIVOS_ENDPOINTS.LISTS}/${item.listId}`,
                headers
            })
            listInfo = listRes.data
        }

        return { item, rawData: itemRes.data, listInfo }
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
        const { itemId, outputStructure, selectedDataFields, updateFLowState } = nodeData.inputs as ICommonObject
        if (!itemId) throw new Error('Item ID is required')

        const state = options.agentflowRuntime?.state

        try {
            const { baseUrl, apiKey } = (await getCredentialData(nodeData.credential, options)) as IPrivosCredential
            const { item, rawData, listInfo } = await this.fetchPrivosData(baseUrl, apiKey, itemId as string)

            const selectedFields = new Set(JSON.parse(selectedDataFields as string))
            const result: any = {
                itemId: item?._id,
                name: item?.name || '',
                description: item?.description || '',
                stageId: item?.stageId || null,
                listId: item?.listId || null,
                key: item?.key || '',
                ...(selectedFields?.has('customFields') && {
                    customFields: mapCustomFields(rawData, listInfo)
                }),
                ...(selectedFields?.has('stages') && {
                    stages: this.handleStageDataField(listInfo)
                })
            }
            if (selectedFields?.has('assignee')) {
                const customFields = mapCustomFields(rawData, listInfo)
                const { assigneeCount, assignees, assigneeFieldId, isAssigned } = this.handleAssigneeDataField(listInfo, customFields)
                result['assigneeCount'] = assigneeCount
                result['assignees'] = assignees
                result['assigneeFieldId'] = assigneeFieldId
                result['isAssigned'] = isAssigned
            }
            if (selectedFields?.has('membersInfo')) {
                const roomType = await this.handleRoomTypeDataField(listInfo, baseUrl, apiKey)
                result['membersInfo'] = await this.handleMembersInfoDataField(listInfo, roomType, baseUrl, apiKey)
                result['roomType'] = roomType
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
                input: { itemId, selectedDataFields },
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

    private handleAssigneeDataField(listInfo: any, customFields: any[]) {
        let assigneeFieldId = null
        const fieldDefinitions = listInfo?.list?.fieldDefinitions || []

        // Method 1: Find USER type field in fieldDefinitions
        if (Array.isArray(fieldDefinitions) && fieldDefinitions.length > 0) {
            // First try to find field named "Persons" with type USER
            let userField = fieldDefinitions.find((field) => {
                const fieldName = (field.name || '').toLowerCase()
                const fieldType = (field.type || '').toUpperCase()
                return fieldName === 'persons' && fieldType === 'USER'
            })

            // If not found, find ANY field with type USER
            if (!userField) {
                userField = fieldDefinitions.find((field) => {
                    const fieldType = (field.type || '').toUpperCase()
                    return fieldType === 'USER'
                })
            }

            if (userField && userField._id) {
                assigneeFieldId = userField._id
                console.log(`Found assignee field: ${userField.name} (ID: ${assigneeFieldId})`)
            } else {
                console.log('No USER type field found in fieldDefinitions')
            }
        }

        // Method 2: If fieldDefinitions empty, detect from items' customFields
        if (!assigneeFieldId && listInfo?.items && listInfo.items.length > 0) {
            // Find a field that has array of user objects (with _id and username)
            for (const item of listInfo.items) {
                const customFields = item?.customFields || []
                for (const cf of customFields) {
                    if (Array.isArray(cf.value) && cf.value.length > 0) {
                        // Check if it looks like user array
                        const firstValue = cf.value[0]
                        if (firstValue && firstValue._id && (firstValue.username || firstValue.name)) {
                            assigneeFieldId = cf.fieldId
                            console.log(`Detected assignee field from items: ${assigneeFieldId}`)
                            break
                        }
                    }
                }
                if (assigneeFieldId) break
            }
        }

        if (!assigneeFieldId) {
            assigneeFieldId = 'no_assignee_field'
            console.log('Could not detect assignee field ID - using placeholder')
        }

        // PARSE ITEMS WITH ASSIGNEES
        let assignees = []

        // Try to find assignees using dynamic field ID first
        if (assigneeFieldId) {
            const assigneeField = customFields.find((cf) => cf.fieldId === assigneeFieldId)
            if (assigneeField && Array.isArray(assigneeField.value)) {
                assignees = assigneeField.value.map((user: any) => ({
                    _id: user._id || '',
                    username: user.username || user.name || '',
                    name: user.name || user.username || ''
                }))
            }
        } else {
            // Fallback: Try known field IDs for backward compatibility
            const marketingAssignees = customFields.find((cf) => cf.fieldId === 'marketing_campaign_assignees_field')
            const recruitmentInterviewer = customFields.find((cf) => cf.fieldId === 'personnel_recruitment_interviewer_field')

            if (marketingAssignees && Array.isArray(marketingAssignees.value)) {
                assignees = marketingAssignees.value.map((user: any) => ({
                    _id: user._id || '',
                    username: user.username || user.name || '',
                    name: user.name || user.username || ''
                }))
            } else if (recruitmentInterviewer && Array.isArray(recruitmentInterviewer.value)) {
                assignees = recruitmentInterviewer.value.map((user: any) => ({
                    _id: user._id || '',
                    username: user.username || user.name || '',
                    name: user.name || user.username || ''
                }))
            }
        }

        return {
            assigneeFieldId,
            assignees,
            assigneeCount: assignees.length,
            isAssigned: assignees.length > 0
        }
    }

    private async handleRoomTypeDataField(listInfo: any, baseUrl: string, apiKey: string) {
        if (!listInfo?.list?.roomId) return 'c'

        try {
            const res = await secureAxiosRequest({
                url: `${baseUrl}${PRIVOS_ENDPOINTS.ROOMS}`,
                headers: { 'X-API-KEY': apiKey }
            })

            const room = (res.data?.update || []).find((r: any) => r._id === listInfo.list.roomId)
            return room?.t || 'c'
        } catch (error) {
            console.log('Error fetching room type:', error?.message)
            return 'c'
        }
    }

    private async handleMembersInfoDataField(listInfo: any, roomType: string, baseUrl: string, apiKey: string) {
        if (!listInfo?.list?.roomId) return []

        const urlByRoomType: Record<string, string> = {
            p: PRIVOS_ENDPOINTS.GROUPS_MEMBERS,
            d: PRIVOS_ENDPOINTS.IM_MEMBERS,
            c: PRIVOS_ENDPOINTS.CHANNELS_MEMBERS
        }
        const membersEndpoint = urlByRoomType[roomType] || PRIVOS_ENDPOINTS.CHANNELS_MEMBERS

        try {
            const membersRes = await secureAxiosRequest({
                url: `${baseUrl}${membersEndpoint}?roomId=${encodeURIComponent(listInfo.list.roomId)}&count=200`,
                headers: { 'X-API-KEY': apiKey }
            })
            // const membersRes = await axios({
            //     method: 'GET',
            //     headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
            //     url: `${baseUrl}${membersEndpoint}`
            // })

            const membersInfo = (membersRes.data?.members || []).map((m: any) => ({
                _id: m._id,
                username: m.username || m.name || m._id,
                name: m.name || m.username || '',
                roles: m.roles || []
            }))
            return membersInfo
        } catch (error) {
            console.log('Error fetching members info:', error?.message)
            return []
        }
    }
}

module.exports = { nodeClass: GetItemInfo_Privos }
