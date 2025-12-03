import { DataSource, Repository } from 'typeorm'
import { Queue } from 'bullmq'
import { ChatFlow } from '../../database/entities/ChatFlow'
import logger from '../../utils/logger'
import { QueueManager } from '../../queue/QueueManager'

export interface ScheduleConfig {
    cronExpression: string // e.g., "0 8 * * *" for 8 AM daily
    timezone?: string // e.g., "Asia/Ho_Chi_Minh"
    enabled: boolean
}

export class ScheduleManager {
    private static instance: ScheduleManager
    private appDataSource: DataSource
    private chatFlowRepository: Repository<ChatFlow>
    private scheduleQueue: Queue
    private queueManager: QueueManager
    private isInitialized: boolean = false

    private constructor() {}

    public static getInstance(): ScheduleManager {
        if (!ScheduleManager.instance) {
            ScheduleManager.instance = new ScheduleManager()
        }
        return ScheduleManager.instance
    }

    public async initialize(appDataSource: DataSource, queueManager: QueueManager): Promise<void> {
        try {
            this.appDataSource = appDataSource
            this.queueManager = queueManager
            this.chatFlowRepository = this.appDataSource.getRepository(ChatFlow)

            // Create a dedicated queue for scheduled flows
            this.scheduleQueue = new Queue('flowise-schedule', {
                connection: this.queueManager.getConnection()
            })

            this.isInitialized = true
            logger.info('[ScheduleManager] Initialized successfully')

            // Load all scheduled flows on startup
            await this.loadScheduledFlows()
        } catch (error) {
            this.isInitialized = false
            logger.error('[ScheduleManager] Failed to initialize:', error)
            throw error
        }
    }

    private checkInitialized(): void {
        if (!this.isInitialized || !this.scheduleQueue) {
            throw new Error(
                'ScheduleManager is not initialized. Make sure MODE=queue is set and Redis is connected. Check server logs for initialization errors.'
            )
        }
    }

    /**
     * Load all enabled scheduled flows from database and register them
     */
    public async loadScheduledFlows(): Promise<void> {
        try {
            const scheduledFlows = await this.chatFlowRepository.find({
                where: { scheduleEnabled: true }
            })

            logger.info(`[ScheduleManager] Loading ${scheduledFlows.length} scheduled flows`)

            for (const flow of scheduledFlows) {
                if (flow.scheduleConfig) {
                    try {
                        const config: ScheduleConfig = JSON.parse(flow.scheduleConfig)
                        if (config.enabled && config.cronExpression) {
                            await this.registerScheduledFlow(flow.id, config)
                        }
                    } catch (error) {
                        logger.error(`[ScheduleManager] Failed to parse schedule config for flow ${flow.id}:`, error)
                    }
                }
            }

            logger.info('[ScheduleManager] All scheduled flows loaded successfully')
        } catch (error) {
            logger.error('[ScheduleManager] Failed to load scheduled flows:', error)
        }
    }

    /**
     * Register a chatflow for scheduled execution
     */
    public async registerScheduledFlow(chatflowId: string, config: ScheduleConfig): Promise<void> {
        this.checkInitialized()

        try {
            // Remove existing repeatable job if any
            await this.unregisterScheduledFlow(chatflowId)

            // Add new repeatable job
            await this.scheduleQueue.add(
                `schedule-${chatflowId}`,
                {
                    chatflowId,
                    type: 'scheduled-execution'
                },
                {
                    repeat: {
                        pattern: config.cronExpression,
                        tz: config.timezone || 'UTC'
                    },
                    jobId: `schedule-${chatflowId}` // Use consistent jobId for easy removal
                }
            )

            logger.info(`[ScheduleManager] Registered schedule for chatflow ${chatflowId} with cron: ${config.cronExpression}`)
        } catch (error) {
            logger.error(`[ScheduleManager] Failed to register schedule for chatflow ${chatflowId}:`, error)
            throw error
        }
    }

    /**
     * Unregister a scheduled chatflow
     */
    public async unregisterScheduledFlow(chatflowId: string): Promise<void> {
        this.checkInitialized()

        try {
            const jobName = `schedule-${chatflowId}`

            // Get all job schedulers (new BullMQ API for repeatable jobs)
            const jobSchedulers = await this.scheduleQueue.getJobSchedulers()

            // Filter schedulers by the specific name for the chatflow
            const schedulersToRemove = jobSchedulers.filter((scheduler) => scheduler.name === jobName)

            // Remove each found job scheduler
            if (schedulersToRemove.length > 0) {
                for (const scheduler of schedulersToRemove) {
                    await this.scheduleQueue.removeJobScheduler(scheduler.key)
                    logger.info(
                        `[ScheduleManager] Removed schedule job ${scheduler.name} (key: ${scheduler.key}) for chatflow ${chatflowId}`
                    )
                }
                logger.info(
                    `[ScheduleManager] Successfully removed ${schedulersToRemove.length} schedule job(s) for chatflow ${chatflowId}`
                )
            } else {
                logger.info(`[ScheduleManager] No schedule jobs found for chatflow ${chatflowId}`)
            }
        } catch (error) {
            logger.error(`[ScheduleManager] Failed to unregister schedule for chatflow ${chatflowId}:`, error)
        }
    }

    /**
     * Update schedule for a chatflow
     */
    public async updateSchedule(chatflowId: string, config: ScheduleConfig): Promise<void> {
        this.checkInitialized()

        if (config.enabled && config.cronExpression) {
            await this.registerScheduledFlow(chatflowId, config)
        } else {
            await this.unregisterScheduledFlow(chatflowId)
        }
    }

    /**
     * Enable schedule for a chatflow
     */
    public async enableSchedule(chatflowId: string): Promise<void> {
        this.checkInitialized()

        const chatflow = await this.chatFlowRepository.findOne({ where: { id: chatflowId } })
        if (!chatflow) {
            throw new Error(`Chatflow ${chatflowId} not found`)
        }

        if (chatflow.scheduleConfig) {
            const config: ScheduleConfig = JSON.parse(chatflow.scheduleConfig)
            config.enabled = true
            chatflow.scheduleConfig = JSON.stringify(config)
            chatflow.scheduleEnabled = true
            await this.chatFlowRepository.save(chatflow)
            await this.registerScheduledFlow(chatflowId, config)
        }
    }

    /**
     * Disable schedule for a chatflow
     */
    public async disableSchedule(chatflowId: string): Promise<void> {
        this.checkInitialized()

        const chatflow = await this.chatFlowRepository.findOne({ where: { id: chatflowId } })
        if (!chatflow) {
            throw new Error(`Chatflow ${chatflowId} not found`)
        }

        if (chatflow.scheduleConfig) {
            const config: ScheduleConfig = JSON.parse(chatflow.scheduleConfig)
            config.enabled = false
            chatflow.scheduleConfig = JSON.stringify(config)
            chatflow.scheduleEnabled = false
            await this.chatFlowRepository.save(chatflow)
            await this.unregisterScheduledFlow(chatflowId)
        }
    }

    /**
     * Get all scheduled flows
     */
    public async getScheduledFlows(): Promise<ChatFlow[]> {
        this.checkInitialized()

        return await this.chatFlowRepository.find({
            where: { scheduleEnabled: true }
        })
    }

    /**
     * Get repeatable jobs from the queue
     */
    public async getRepeatableJobs(): Promise<any[]> {
        this.checkInitialized()

        // The `getRepeatableJobs` method is deprecated. The new method is `getJobs(['repeat'])`.
        return await this.scheduleQueue.getJobs(['repeat'])
    }

    /**
     * Get the schedule queue instance
     */
    public getQueue(): Queue {
        this.checkInitialized()

        return this.scheduleQueue
    }

    /**
     * Get queue statistics and health status
     */
    public async getQueueStats(): Promise<{
        waiting: number
        active: number
        completed: number
        failed: number
        delayed: number
        repeatableJobs: number
    }> {
        this.checkInitialized()

        const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
            this.scheduleQueue.getWaitingCount(),
            this.scheduleQueue.getActiveCount(),
            this.scheduleQueue.getCompletedCount(),
            this.scheduleQueue.getFailedCount(),
            this.scheduleQueue.getDelayedCount(),
            this.scheduleQueue.getJobs(['repeat']) // Replaced deprecated getRepeatableJobs()
        ])

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            repeatableJobs: repeatableJobs.length
        }
    }

    /**
     * Get detailed health status
     */
    public async getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy'
        initialized: boolean
        queueStats: any
        scheduledFlowsCount: number
        activeSchedules: number
    }> {
        if (!this.isInitialized) {
            return {
                status: 'unhealthy',
                initialized: false,
                queueStats: null,
                scheduledFlowsCount: 0,
                activeSchedules: 0
            }
        }

        try {
            const queueStats = await this.getQueueStats()
            const scheduledFlows = await this.getScheduledFlows()

            // Consider unhealthy if more than 10% of jobs are failing
            const totalProcessed = queueStats.completed + queueStats.failed
            const failureRate = totalProcessed > 0 ? (queueStats.failed / totalProcessed) * 100 : 0

            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
            if (failureRate > 50) {
                status = 'unhealthy'
            } else if (failureRate > 10) {
                status = 'degraded'
            }

            return {
                status,
                initialized: true,
                queueStats,
                scheduledFlowsCount: scheduledFlows.length,
                activeSchedules: queueStats.repeatableJobs
            }
        } catch (error) {
            logger.error('[ScheduleManager] Failed to get health status:', error)
            return {
                status: 'unhealthy',
                initialized: true,
                queueStats: null,
                scheduledFlowsCount: 0,
                activeSchedules: 0
            }
        }
    }
}
