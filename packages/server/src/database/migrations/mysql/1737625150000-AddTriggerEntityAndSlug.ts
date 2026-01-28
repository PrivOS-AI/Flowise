import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTriggerEntityAndSlug1737625150000 implements MigrationInterface {
    name = 'AddTriggerEntityAndSlug1737625150000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create trigger table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS trigger (
                id VARCHAR(36) NOT NULL,
                flowId VARCHAR(36),
                botId VARCHAR(50),
                config JSON,
                events JSON,
                isEnabled TINYINT(1) DEFAULT 1 NOT NULL,
                slug VARCHAR(100) UNIQUE,
                type VARCHAR(100) DEFAULT 'privos' NOT NULL,
                description TEXT,
                createdDate TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) NOT NULL,
                updatedDate TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) NOT NULL,
                workspaceId VARCHAR(255),
                PRIMARY KEY (id)
            )
        `)

        // Add slug column to chat_flow table
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow ADD COLUMN slug VARCHAR(100) UNIQUE`)
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('Duplicate column name')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE trigger`)

        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow DROP COLUMN slug`)
        } catch (error) {
            if (error instanceof Error) {
                console.warn('Failed to drop slug column:', error.message)
            } else {
                console.warn('Failed to drop slug column:', String(error))
            }
        }
    }
}
