import { INodeParams, INodeCredential } from '../src/Interface'

class BotPrivosCredential implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'Bot Privos Credential'
        this.name = 'botPrivosCredential'
        this.version = 2.0
        this.inputs = [
            {
                label: 'Token',
                name: 'authToken',
                type: 'password',
                description: 'Your PrivOs authentication token'
            },
            {
                label: 'Secret Key',
                name: 'secretKey',
                type: 'password',
                description: 'Your PrivOs secret key',
                optional: true
            }
        ]
    }
}

module.exports = { credClass: BotPrivosCredential }
