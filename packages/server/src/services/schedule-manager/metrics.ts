import logger from '../../utils/logger'

export interface ScheduleMetrics {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    lastExecutionTime?: Date
    activeJobs: number
    queuedJobs: number
}

export class ScheduleMetricsCollector {
    private metrics: Map<string, ScheduleMetrics> = new Map()
    private executionTimes: Map<string, number[]> = new Map()
    private globalMetrics: ScheduleMetrics = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        activeJobs: 0,
        queuedJobs: 0
    }

    /**
     * Record the start of a job execution
     */
    public recordJobStart(chatflowId: string): number {
        const startTime = Date.now()

        // Initialize metrics for this chatflow if not exists
        if (!this.metrics.has(chatflowId)) {
            this.metrics.set(chatflowId, {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                averageExecutionTime: 0,
                activeJobs: 0,
                queuedJobs: 0
            })
            this.executionTimes.set(chatflowId, [])
        }

        const metric = this.metrics.get(chatflowId)!
        metric.activeJobs++
        metric.totalExecutions++
        this.globalMetrics.activeJobs++
        this.globalMetrics.totalExecutions++

        return startTime
    }

    /**
     * Record successful job completion
     */
    public recordJobSuccess(chatflowId: string, startTime: number): void {
        const executionTime = Date.now() - startTime

        const metric = this.metrics.get(chatflowId)
        if (metric) {
            metric.successfulExecutions++
            metric.activeJobs--
            metric.lastExecutionTime = new Date()

            // Update execution times
            const times = this.executionTimes.get(chatflowId) || []
            times.push(executionTime)

            // Keep only last 100 execution times to calculate average
            if (times.length > 100) {
                times.shift()
            }

            this.executionTimes.set(chatflowId, times)
            metric.averageExecutionTime = times.reduce((a, b) => a + b, 0) / times.length
        }

        this.globalMetrics.successfulExecutions++
        this.globalMetrics.activeJobs--

        logger.info(`[ScheduleMetrics] Chatflow ${chatflowId} executed successfully in ${executionTime}ms`)
    }

    /**
     * Record job failure
     */
    public recordJobFailure(chatflowId: string, startTime: number, error: Error): void {
        const executionTime = Date.now() - startTime

        const metric = this.metrics.get(chatflowId)
        if (metric) {
            metric.failedExecutions++
            metric.activeJobs--
            metric.lastExecutionTime = new Date()
        }

        this.globalMetrics.failedExecutions++
        this.globalMetrics.activeJobs--

        logger.error(`[ScheduleMetrics] Chatflow ${chatflowId} failed after ${executionTime}ms:`, error.message)
    }

    /**
     * Update queue depth metrics
     */
    public updateQueueMetrics(chatflowId: string, queuedJobs: number): void {
        const metric = this.metrics.get(chatflowId)
        if (metric) {
            metric.queuedJobs = queuedJobs
        }
    }

    /**
     * Get metrics for a specific chatflow
     */
    public getChatflowMetrics(chatflowId: string): ScheduleMetrics | undefined {
        return this.metrics.get(chatflowId)
    }

    /**
     * Get global metrics across all chatflows
     */
    public getGlobalMetrics(): ScheduleMetrics {
        return { ...this.globalMetrics }
    }

    /**
     * Get all chatflow metrics
     */
    public getAllMetrics(): Map<string, ScheduleMetrics> {
        return new Map(this.metrics)
    }

    /**
     * Get success rate for a chatflow
     */
    public getSuccessRate(chatflowId: string): number {
        const metric = this.metrics.get(chatflowId)
        if (!metric || metric.totalExecutions === 0) return 0
        return (metric.successfulExecutions / metric.totalExecutions) * 100
    }

    /**
     * Get global success rate
     */
    public getGlobalSuccessRate(): number {
        if (this.globalMetrics.totalExecutions === 0) return 0
        return (this.globalMetrics.successfulExecutions / this.globalMetrics.totalExecutions) * 100
    }

    /**
     * Reset metrics for a chatflow
     */
    public resetChatflowMetrics(chatflowId: string): void {
        this.metrics.delete(chatflowId)
        this.executionTimes.delete(chatflowId)
        logger.info(`[ScheduleMetrics] Reset metrics for chatflow ${chatflowId}`)
    }

    /**
     * Reset all metrics
     */
    public resetAllMetrics(): void {
        this.metrics.clear()
        this.executionTimes.clear()
        this.globalMetrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            activeJobs: 0,
            queuedJobs: 0
        }
        logger.info('[ScheduleMetrics] Reset all metrics')
    }

    /**
     * Print metrics summary to logs (useful for monitoring)
     */
    public logMetricsSummary(): void {
        logger.info('=== Schedule Metrics Summary ===')
        logger.info(`Global Stats:`)
        logger.info(`  Total Executions: ${this.globalMetrics.totalExecutions}`)
        logger.info(`  Successful: ${this.globalMetrics.successfulExecutions}`)
        logger.info(`  Failed: ${this.globalMetrics.failedExecutions}`)
        logger.info(`  Success Rate: ${this.getGlobalSuccessRate().toFixed(2)}%`)
        logger.info(`  Active Jobs: ${this.globalMetrics.activeJobs}`)

        logger.info(`\nPer-Chatflow Stats:`)
        this.metrics.forEach((metric, chatflowId) => {
            logger.info(`  Chatflow ${chatflowId}:`)
            logger.info(`    Total: ${metric.totalExecutions}`)
            logger.info(`    Success: ${metric.successfulExecutions}`)
            logger.info(`    Failed: ${metric.failedExecutions}`)
            logger.info(`    Success Rate: ${this.getSuccessRate(chatflowId).toFixed(2)}%`)
            logger.info(`    Avg Execution Time: ${metric.averageExecutionTime.toFixed(2)}ms`)
            logger.info(`    Last Execution: ${metric.lastExecutionTime?.toISOString() || 'Never'}`)
        })
        logger.info('================================')
    }
}
