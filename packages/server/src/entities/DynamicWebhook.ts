import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * DynamicWebhook Entity
 * Stores user-created webhooks with unique IDs
 */
@Entity('dynamic_webhook')
export class DynamicWebhook {
    @PrimaryColumn('uuid')
    id: string

    /**
     * Unique webhook ID (used in URL)
     * Example: wh_abc123xyz
     */
    @Column({ unique: true })
    webhookId: string

    /**
     * User-defined name for this webhook
     */
    @Column()
    name: string

    /**
     * Webhook description
     */
    @Column({ nullable: true })
    description: string

    /**
     * Third-party URL to forward data to
     */
    @Column()
    targetUrl: string

    /**
     * HTTP method for forwarding (POST, PUT, PATCH)
     */
    @Column({ default: 'POST' })
    targetMethod: string

    /**
     * Headers to include in forwarding request
     * JSON string: {"Authorization": "Bearer xxx"}
     */
    @Column({ type: 'json', nullable: true })
    targetHeaders: Record<string, string>

    /**
     * Field mapping configuration
     * Maps incoming fields to target fields
     * Example: {"email": "contact_email", "phone": "mobile"}
     */
    @Column({ type: 'json', nullable: true })
    fieldMapping: Record<string, string>

    /**
     * Data transformation template (Mustache/Handlebars)
     * Example: {"customer_email": "{{email}}", "contact_phone": "{{phone}}"}
     */
    @Column({ type: 'text', nullable: true })
    transformTemplate: string

    /**
     * Webhook status
     */
    @Column({ default: true })
    isActive: boolean

    /**
     * Require authentication (API key)
     */
    @Column({ default: false })
    requireAuth: boolean

    /**
     * API key for authentication (if required)
     */
    @Column({ nullable: true })
    apiKey: string

    /**
     * Allowed origins for CORS (comma-separated)
     */
    @Column({ nullable: true })
    allowedOrigins: string

    /**
     * Rate limiting (max requests per minute)
     */
    @Column({ default: 60 })
    rateLimit: number

    /**
     * Retry configuration
     */
    @Column({ type: 'json', nullable: true })
    retryConfig: {
        maxRetries: number
        retryDelay: number // milliseconds
        backoffMultiplier: number
    }

    /**
     * Webhook statistics
     */
    @Column({ type: 'json', default: {} })
    stats: {
        totalReceived: number
        totalForwarded: number
        totalFailed: number
        lastReceivedAt: Date | null
        lastForwardedAt: Date | null
    }

    /**
     * Room/Workspace ID for multi-tenancy
     */
    @Column()
    roomId: string

    /**
     * User ID who created this webhook
     */
    @Column()
    userId: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date

    /**
     * Soft delete
     */
    @Column({ default: false })
    isDeleted: boolean
}

/**
 * WebhookLog Entity
 * Logs all webhook activities
 */
@Entity('webhook_log')
export class WebhookLog {
    @PrimaryColumn('uuid')
    id: string

    @Column()
    webhookId: string

    /**
     * Incoming request data
     */
    @Column({ type: 'json' })
    incomingPayload: Record<string, any>

    /**
     * Outgoing data (after transformation)
     */
    @Column({ type: 'json', nullable: true })
    outgoingPayload: Record<string, any>

    /**
     * Processing status
     */
    @Column({
        type: 'enum',
        enum: ['received', 'forwarded', 'failed'],
        default: 'received'
    })
    status: 'received' | 'forwarded' | 'failed'

    /**
     * HTTP status code from third-party
     */
    @Column({ nullable: true })
    httpStatusCode: number

    /**
     * Response from third-party
     */
    @Column({ type: 'json', nullable: true })
    thirdPartyResponse: Record<string, any>

    /**
     * Error message (if failed)
     */
    @Column({ type: 'text', nullable: true })
    errorMessage: string

    /**
     * Processing time (milliseconds)
     */
    @Column({ nullable: true })
    processingTime: number

    /**
     * Source IP address
     */
    @Column({ nullable: true })
    sourceIp: string

    /**
     * User agent
     */
    @Column({ nullable: true })
    userAgent: string

    /**
     * Request ID for tracing
     */
    @Column()
    requestId: string

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    receivedAt: Date
}
