import { Worker, Job, QueueEvents } from 'bullmq'
import { DataSource } from 'typeorm'
import logger from '../../utils/logger'
import { QueueManager } from '../../queue/QueueManager'
import { IComponentNodes } from '../../Interface'
import { CachePool } from '../../CachePool'
import { Telemetry } from '../../utils/telemetry'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ScheduleMetricsCollector } from './metrics'
import { SCHEDULE_WORKER_CONFIG } from '../../utils/constants'

interface ScheduledJobData {
    chatflowId: string
    type: 'scheduled-execution'
}

export class ScheduleWorker {
    private worker: Worker
    private appDataSource: DataSource
    private predictionQueueEvents: QueueEvents
    private metricsCollector: ScheduleMetricsCollector

    constructor(
        queueManager: QueueManager,
        appDataSource: DataSource,
        _componentNodes: IComponentNodes, // Keep for future use
        _cachePool: CachePool, // Keep for future use
        _telemetry: Telemetry // Keep for future use
    ) {
        this.appDataSource = appDataSource
        this.metricsCollector = new ScheduleMetricsCollector()

        // Create QueueEvents for prediction queue to monitor job completion
        const predictionQueue = queueManager.getQueue('prediction')
        this.predictionQueueEvents = new QueueEvents(predictionQueue.getQueueName(), {
            connection: queueManager.getConnection()
        })

        // Create worker for schedule queue with configurable settings
        this.worker = new Worker(
            'flowise-schedule',
            async (job: Job<ScheduledJobData>) => {
                return await this.processScheduledJob(job)
            },
            {
                connection: queueManager.getConnection(),
                concurrency: SCHEDULE_WORKER_CONFIG.CONCURRENCY,
                lockDuration: SCHEDULE_WORKER_CONFIG.LOCK_DURATION,
                stalledInterval: SCHEDULE_WORKER_CONFIG.STALLED_INTERVAL
            }
        )

        logger.info(
            `[ScheduleWorker] Worker started with concurrency=${SCHEDULE_WORKER_CONFIG.CONCURRENCY}, lockDuration=${SCHEDULE_WORKER_CONFIG.LOCK_DURATION}ms, stalledInterval=${SCHEDULE_WORKER_CONFIG.STALLED_INTERVAL}ms`
        )

        this.worker.on('completed', (job) => {
            logger.info(`[ScheduleWorker] Job ${job.id} completed successfully`)
        })

        this.worker.on('failed', (job, err) => {
            logger.error(`[ScheduleWorker] Job ${job?.id} failed:`, err)
        })

        logger.info('[ScheduleWorker] Worker initialized successfully')

        // Log metrics summary periodically
        setInterval(() => {
            this.metricsCollector.logMetricsSummary()
        }, SCHEDULE_WORKER_CONFIG.METRICS_INTERVAL)
    }

    private async processScheduledJob(job: Job<ScheduledJobData>): Promise<any> {
        const { chatflowId } = job.data
        const startTime = this.metricsCollector.recordJobStart(chatflowId)

        try {
            logger.info(`[ScheduleWorker] Processing scheduled execution for chatflow: ${chatflowId}`)

            // Get chatflow from database
            const chatflowRepository = this.appDataSource.getRepository(ChatFlow)
            const chatflow = await chatflowRepository.findOne({ where: { id: chatflowId } })

            if (!chatflow) {
                throw new Error(`Chatflow ${chatflowId} not found`)
            }

            // CHECK: Verify schedule is still enabled in database
            // This prevents execution if schedule was disabled while server was down
            if (!chatflow.scheduleEnabled) {
                logger.warn(
                    `[ScheduleWorker] Skipping execution for chatflow ${chatflowId}: Schedule is disabled in database. ` +
                        `This job should be removed from Redis queue.`
                )
                // Return a skip result instead of throwing error
                return {
                    skipped: true,
                    reason: 'Schedule disabled',
                    chatflowId,
                    timestamp: new Date().toISOString()
                }
            }

            // Parse and verify schedule config
            let scheduleConfig: any = null
            if (chatflow.scheduleConfig) {
                try {
                    scheduleConfig = JSON.parse(chatflow.scheduleConfig)
                } catch (error) {
                    logger.error(`[ScheduleWorker] Invalid schedule config for chatflow ${chatflowId}:`, error)
                }
            }

            // Double check enabled flag in config (if exists)
            if (scheduleConfig && scheduleConfig.enabled === false) {
                logger.warn(`[ScheduleWorker] Skipping execution for chatflow ${chatflowId}: Schedule config enabled=false`)
                return {
                    skipped: true,
                    reason: 'Schedule config disabled',
                    chatflowId,
                    timestamp: new Date().toISOString()
                }
            }

            // Build and execute the flow
            const result = await this.executeChatflow(chatflow)

            // Record success metrics
            this.metricsCollector.recordJobSuccess(chatflowId, startTime)

            return result
        } catch (error: any) {
            logger.error(`[ScheduleWorker] Error processing scheduled job for chatflow ${chatflowId}:`, error)

            // Record failure metrics
            this.metricsCollector.recordJobFailure(chatflowId, startTime, error)

            throw error
        }
    }

    private async executeChatflow(chatflow: any): Promise<any> {
        try {
            // Use prediction queue for both CHATFLOW and AGENTFLOW
            // This ensures consistent execution with proper error handling, retry, etc.
            const predictionQueue = QueueManager.getInstance().getQueue('prediction')

            const chatId = `schedule-${chatflow.id}-${Date.now()}`
            const sessionId = `schedule-${Date.now()}`

            // Schedule trigger = auto, no user input needed
            // userId and messageJson will be empty for scheduled trigger
            // When user replies, Privos will call flow API with populated params
            const uploads: any[] = []

            // userId - empty for schedule trigger (auto broadcast)
            uploads.push({
                data: `data:text/plain;base64,${Buffer.from('').toString('base64')}`,
                type: 'file:full',
                name: 'userId',
                mime: 'text/plain'
            })

            // messageJson - empty for schedule trigger
            uploads.push({
                data: `data:text/plain;base64,${Buffer.from('{}').toString('base64')}`,
                type: 'file:full',
                name: 'messageJson',
                mime: 'text/plain'
            })

            const job = await predictionQueue.addJob({
                chatflow: chatflow, // Pass full chatflow object
                incomingInput: {
                    question: '', // Empty for schedule trigger (auto broadcast)
                    uploads: uploads,
                    overrideConfig: {},
                    chatId: chatId,
                    sessionId: sessionId
                },
                chatId: chatId,
                orgId: chatflow.orgId || '',
                workspaceId: chatflow.workspaceId || '',
                subscriptionId: '',
                productId: '',
                baseURL: '',
                isInternal: true // Mark as internal execution
            })

            logger.info(`[ScheduleWorker] Flow execution queued with job ID: ${job.id}`)

            // Wait for job to complete WITHOUT timeout - let it run as long as needed
            try {
                const completedJob = await job.waitUntilFinished(this.predictionQueueEvents)

                logger.info(`[ScheduleWorker] Job ${job.id} completed successfully`)
                return completedJob
            } catch (error: any) {
                logger.error(`[ScheduleWorker] Job ${job.id} failed:`, error)
                throw error
            }
        } catch (error) {
            logger.error(`[ScheduleWorker] Error executing chatflow:`, error)
            throw error
        }
    }

    public getMetricsCollector(): ScheduleMetricsCollector {
        return this.metricsCollector
    }

    public async close(): Promise<void> {
        await this.worker.close()
        await this.predictionQueueEvents.close()
        logger.info('[ScheduleWorker] Worker closed')
    }
}
