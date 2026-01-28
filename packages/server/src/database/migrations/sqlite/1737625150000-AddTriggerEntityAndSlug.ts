import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTriggerEntityAndSlug1737625150000 implements MigrationInterface {
    name = 'AddTriggerEntityAndSlug1737625150000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create trigger table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS trigger (
                id TEXT PRIMARY KEY,
                flowId TEXT,
                botId TEXT,
                config TEXT,
                events TEXT,
                isEnabled BOOLEAN DEFAULT 1 NOT NULL,
                slug TEXT UNIQUE,
                type TEXT DEFAULT 'privos' NOT NULL,
                description TEXT,
                createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updatedDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                workspaceId TEXT
            )
        `)

        // Add slug column to chat_flow table
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "slug" VARCHAR(100) UNIQUE`)
        } catch (error: any) {
            if (!error.message.includes('duplicate column name')) {
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
        console.warn('SQLite does not support DROP COLUMN. Column slug will remain.')
    }
}
