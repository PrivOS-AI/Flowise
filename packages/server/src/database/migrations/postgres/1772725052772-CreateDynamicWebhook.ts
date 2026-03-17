import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateDynamicWebhook1772725052772 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create dynamic_webhook table
        await queryRunner.createTable(
            new Table({
                name: 'dynamic_webhook',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true
                    },
                    {
                        name: 'webhookId',
                        type: 'varchar',
                        isUnique: true
                    },
                    {
                        name: 'name',
                        type: 'varchar'
                    },
                    {
                        name: 'description',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'targetUrl',
                        type: 'varchar'
                    },
                    {
                        name: 'targetMethod',
                        type: 'varchar',
                        default: "'POST'"
                    },
                    {
                        name: 'targetHeaders',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'fieldMapping',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'transformTemplate',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true
                    },
                    {
                        name: 'requireAuth',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'apiKey',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'allowedOrigins',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'rateLimit',
                        type: 'integer',
                        default: 60
                    },
                    {
                        name: 'retryConfig',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'stats',
                        type: 'jsonb',
                        default: "'{}'"
                    },
                    {
                        name: 'roomId',
                        type: 'varchar'
                    },
                    {
                        name: 'userId',
                        type: 'varchar'
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp'
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp'
                    },
                    {
                        name: 'isDeleted',
                        type: 'boolean',
                        default: false
                    }
                ]
            }),
            true
        )

        // Create indexes
        await queryRunner.createIndex(
            'dynamic_webhook',
            new TableIndex({
                name: 'IDX_webhook_webhookId',
                columnNames: ['webhookId']
            })
        )

        await queryRunner.createIndex(
            'dynamic_webhook',
            new TableIndex({
                name: 'IDX_webhook_roomId',
                columnNames: ['roomId']
            })
        )

        // Create webhook_log table
        await queryRunner.createTable(
            new Table({
                name: 'webhook_log',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true
                    },
                    {
                        name: 'webhookId',
                        type: 'varchar'
                    },
                    {
                        name: 'incomingPayload',
                        type: 'jsonb'
                    },
                    {
                        name: 'outgoingPayload',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        default: "'received'"
                    },
                    {
                        name: 'httpStatusCode',
                        type: 'integer',
                        isNullable: true
                    },
                    {
                        name: 'thirdPartyResponse',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'errorMessage',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'processingTime',
                        type: 'integer',
                        isNullable: true
                    },
                    {
                        name: 'sourceIp',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'userAgent',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'requestId',
                        type: 'varchar'
                    },
                    {
                        name: 'receivedAt',
                        type: 'timestamp'
                    }
                ]
            }),
            true
        )

        // Create indexes for webhook_log
        await queryRunner.createIndex(
            'webhook_log',
            new TableIndex({
                name: 'IDX_webhooklog_webhookId',
                columnNames: ['webhookId']
            })
        )

        await queryRunner.createIndex(
            'webhook_log',
            new TableIndex({
                name: 'IDX_webhooklog_status',
                columnNames: ['status']
            })
        )

        await queryRunner.createIndex(
            'webhook_log',
            new TableIndex({
                name: 'IDX_webhooklog_receivedAt',
                columnNames: ['receivedAt']
            })
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('webhook_log', true, true)
        await queryRunner.dropTable('dynamic_webhook', true, true)
    }
}
