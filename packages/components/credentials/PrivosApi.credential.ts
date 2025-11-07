import { INodeParams, INodeCredential } from '../src/Interface'
import { DEFAULT_PRIVOS_API_BASE_URL } from '../nodes/PrivOS/constants'

class PrivosApiCredential implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'Privos API'
        this.name = 'privosApi'
        this.version = 2.0
        this.inputs = [
            {
                label: 'API Base URL',
                name: 'baseUrl',
                type: 'string',
                default: DEFAULT_PRIVOS_API_BASE_URL,
                description: 'Base URL for Privos API'
            },
            {
                label: 'User ID (X-User-Id)',
                name: 'userId',
                type: 'string',
                placeholder: 'GRqeKLPGZ8zndK2by',
                description: 'Your Privos User ID for authentication'
            },
            {
                label: 'Auth Token (X-Auth-Token)',
                name: 'authToken',
                type: 'password',
                description: 'Your Privos authentication token'
            }
        ]
    }
}

module.exports = { credClass: PrivosApiCredential }
