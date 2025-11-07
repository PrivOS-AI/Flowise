import * as Server from '../index'
import * as DataSource from '../DataSource'
import logger from '../utils/logger'
import { BaseCommand } from './base'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

async function killMCPProcesses() {
    try {
        if (process.platform === 'win32') {
            // Windows: kill node processes containing MCP server names
            const { stdout } = await execPromise('tasklist /FO CSV /NH')
            const lines = stdout.split('\n')
            const pids: string[] = []

            for (const line of lines) {
                if (line.includes('node.exe')) {
                    const match = line.match(/"(\d+)"/)
                    if (match) {
                        pids.push(match[1])
                    }
                }
            }

            // Check each PID for MCP servers (image-gen-server, video-gen-server)
            const mcpServerNames = ['image-gen-server', 'video-gen-server']
            for (const pid of pids) {
                try {
                    const { stdout: cmdline } = await execPromise(`wmic process where ProcessId=${pid} get CommandLine /FORMAT:LIST`)
                    for (const serverName of mcpServerNames) {
                        if (cmdline.includes(serverName)) {
                            await execPromise(`taskkill /F /PID ${pid}`)
                            logger.info(`🧹 [server]: Killed ${serverName} MCP process (PID: ${pid})`)
                            break
                        }
                    }
                } catch (e) {
                    // Process may have already exited, ignore
                }
            }
        } else {
            // Unix/Linux/Mac
            await execPromise("pkill -f 'image-gen-server' || true")
            await execPromise("pkill -f 'video-gen-server' || true")
            logger.info('🧹 [server]: Killed all MCP server processes')
        }
    } catch (error) {
        logger.warn('⚠️  [server]: Error cleaning up MCP processes:', error)
    }
}

export default class Start extends BaseCommand {
    async run(): Promise<void> {
        logger.info('Starting Flowise...')
        // Kill old MCP server processes before starting
        await killMCPProcesses()
        await DataSource.init()
        await Server.start()
    }

    async catch(error: Error) {
        if (error.stack) logger.error(error.stack)
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }

    async stopProcess() {
        try {
            logger.info(`Shutting down Flowise...`)
            const serverApp = Server.getInstance()
            if (serverApp) await serverApp.stopApp()
            // Kill all MCP server processes on shutdown
            await killMCPProcesses()
        } catch (error) {
            logger.error('There was an error shutting down Flowise...', error)
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
