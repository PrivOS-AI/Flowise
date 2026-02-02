import { RedisEventPublisher } from './RedisEventPublisher'
import { BaseQueue } from './BaseQueue'
import { RedisOptions } from 'bullmq'
import { utilBuildChatflow } from '../utils/buildChatflow'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { Trigger } from '../database/entities/Trigger'
import { ChatFlow } from '../database/entities/ChatFlow'

interface IScheduleJobData {
    chatFlowId: string
    triggerId?: string
}

export class ScheduleQueue extends BaseQueue {
    private redisPublisher: RedisEventPublisher
    private queueName: string

    constructor(name: string, connection: RedisOptions, options: any) {
        super(name, connection)
        this.queueName = name
        this.redisPublisher = new RedisEventPublisher()
        this.redisPublisher.connect()
    }

    public getQueueName() {
        return this.queueName
    }

    public getQueue() {
        return this.queue
    }

    async processJob(data: IScheduleJobData) {
        await utilBuildChatflow(
            {
                params: { id: data.chatFlowId },
                body: {
                    triggerData: {
                        triggerId: data?.triggerId,
                        eventType: 'schedule' // prevent to fix core logic
                    }
                }
            } as any,
            true
        )
    }
}
