import { Worker, Job, QueueEvents } from 'bullmq'
import { DataSource } from 'typeorm'
import axios from 'axios'
import logger from '../../utils/logger'
import { QueueManager } from '../../queue/QueueManager'
import { IComponentNodes } from '../../Interface'
import { CachePool } from '../../CachePool'
import { Telemetry } from '../../utils/telemetry'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ScheduleMetricsCollector } from './metrics'

interface ScheduledJobData {
    chatflowId: string
    webhookUrl?: string
    prompt?: string
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
        const concurrency = parseInt(process.env.SCHEDULE_WORKER_CONCURRENCY || '5')
        const lockDuration = parseInt(process.env.SCHEDULE_LOCK_DURATION || '600000') // 10 minutes
        const stalledInterval = parseInt(process.env.SCHEDULE_STALLED_INTERVAL || '60000') // 60 seconds

        this.worker = new Worker(
            'flowise-schedule',
            async (job: Job<ScheduledJobData>) => {
                return await this.processScheduledJob(job)
            },
            {
                connection: queueManager.getConnection(),
                concurrency, // Configurable via env var
                lockDuration, // Configurable via env var
                stalledInterval // Configurable via env var
            }
        )

        logger.info(
            `[ScheduleWorker] Worker started with concurrency=${concurrency}, lockDuration=${lockDuration}ms, stalledInterval=${stalledInterval}ms`
        )

        this.worker.on('completed', (job) => {
            logger.info(`[ScheduleWorker] Job ${job.id} completed successfully`)
        })

        this.worker.on('failed', (job, err) => {
            logger.error(`[ScheduleWorker] Job ${job?.id} failed:`, err)
        })

        logger.info('[ScheduleWorker] Worker initialized successfully')

        // Log metrics summary every 5 minutes
        const metricsInterval = parseInt(process.env.SCHEDULE_METRICS_INTERVAL || '300000') // 5 minutes
        setInterval(() => {
            this.metricsCollector.logMetricsSummary()
        }, metricsInterval)
    }

    private async processScheduledJob(job: Job<ScheduledJobData>): Promise<any> {
        const { chatflowId, webhookUrl, prompt } = job.data
        const startTime = this.metricsCollector.recordJobStart(chatflowId)

        try {
            logger.info(`[ScheduleWorker] Processing scheduled execution for chatflow: ${chatflowId}`)

            // Get chatflow from database
            const chatflowRepository = this.appDataSource.getRepository(ChatFlow)
            const chatflow = await chatflowRepository.findOne({ where: { id: chatflowId } })

            if (!chatflow) {
                throw new Error(`Chatflow ${chatflowId} not found`)
            }

            // ✅ CHECK: Verify schedule is still enabled in database
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
            const result = await this.executeChatflow(chatflow, prompt)

            // Send result to webhook if configured
            if (webhookUrl) {
                await this.sendWebhook(webhookUrl, {
                    chatflowId,
                    executionTime: new Date().toISOString(),
                    result,
                    status: 'success'
                })
            }

            // Record success metrics
            this.metricsCollector.recordJobSuccess(chatflowId, startTime)

            return result
        } catch (error: any) {
            logger.error(`[ScheduleWorker] Error processing scheduled job for chatflow ${chatflowId}:`, error)

            // Record failure metrics
            this.metricsCollector.recordJobFailure(chatflowId, startTime, error)

            // Send error to webhook if configured
            if (webhookUrl) {
                try {
                    await this.sendWebhook(webhookUrl, {
                        chatflowId,
                        executionTime: new Date().toISOString(),
                        error: error.message,
                        status: 'error'
                    })
                } catch (webhookError) {
                    logger.error(`[ScheduleWorker] Failed to send error webhook:`, webhookError)
                }
            }

            throw error
        }
    }

    private async executeChatflow(chatflow: any, prompt?: string): Promise<any> {
        try {
            // Use prediction queue for both CHATFLOW and AGENTFLOW
            // This ensures consistent execution with proper error handling, retry, etc.
            const predictionQueue = QueueManager.getInstance().getQueue('prediction')

            const chatId = `schedule-${chatflow.id}-${Date.now()}`
            const sessionId = `schedule-${Date.now()}`

            const job = await predictionQueue.addJob({
                chatflow: chatflow, // Pass full chatflow object
                incomingInput: {
                    question: prompt || 'Scheduled execution trigger',
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

            logger.info(
                `[ScheduleWorker] Flow execution queued with job ID: ${job.id}, prompt: "${prompt || 'Scheduled execution trigger'}"`
            )

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

    private async sendWebhook(url: string, payload: any): Promise<void> {
        try {
            logger.info(`[ScheduleWorker] Sending webhook to: ${url}`)

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Flowise-Schedule/1.0'
                },
                timeout: 10000 // 10 second timeout
            })

            logger.info(`[ScheduleWorker] Webhook sent successfully. Status: ${response.status}`)
        } catch (error: any) {
            logger.error(`[ScheduleWorker] Failed to send webhook:`, {
                url,
                error: error.message,
                response: error.response?.data
            })
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
