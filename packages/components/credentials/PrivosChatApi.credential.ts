import { INodeParams, INodeCredential } from '../src/Interface'

class PrivosChatApiCredential implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'Privos Chat API'
        this.name = 'privosChatApi'
        this.version = 1.0
        this.inputs = [
            {
                label: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://privos.roxane.one',
                description: 'Base URL for Privos Chat'
            },
            {
                label: 'API Key (X-API-KEY)',
                name: 'apiKey',
                type: 'password',
                description: 'API Key for authentication with Privos Chat'
            }
        ]
    }
}

module.exports = { credClass: PrivosChatApiCredential }
