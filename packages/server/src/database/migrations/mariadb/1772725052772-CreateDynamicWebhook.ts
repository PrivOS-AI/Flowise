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
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'fieldMapping',
                        type: 'text',
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
                        type: 'int',
                        default: 60
                    },
                    {
                        name: 'retryConfig',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'stats',
                        type: 'text',
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
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
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
                        type: 'text'
                    },
                    {
                        name: 'outgoingPayload',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        default: "'received'"
                    },
                    {
                        name: 'httpStatusCode',
                        type: 'int',
                        isNullable: true
                    },
                    {
                        name: 'thirdPartyResponse',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'errorMessage',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'processingTime',
                        type: 'int',
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('webhook_log', true, true)
        await queryRunner.dropTable('dynamic_webhook', true, true)
    }
}
