import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTriggerEntityAndSlug1737625150000 implements MigrationInterface {
    name = 'AddTriggerEntityAndSlug1737625150000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create trigger table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS trigger (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "flowId" uuid,
                "botId" varchar(50),
                config jsonb,
                events jsonb,
                "isEnabled" boolean DEFAULT true NOT NULL,
                slug VARCHAR(100) UNIQUE,
                type VARCHAR(50) DEFAULT 'privos' NOT NULL,
                description text,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                "workspaceId" uuid,
                "jobKey" varchar(50),
                CONSTRAINT "PK_trigger" PRIMARY KEY (id)
            )
        `)

        // Add slug column to chat_flow table
        const chatFlowTableExists = await queryRunner.hasTable('chat_flow')
        if (!chatFlowTableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow ADD COLUMN "slug" VARCHAR(100) UNIQUE`)
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('column "slug" of relation "chat_flow" already exists')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE trigger`)

        const chatFlowTableExists = await queryRunner.hasTable('chat_flow')
        if (!chatFlowTableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow DROP COLUMN "slug"`)
        } catch (error) {
            if (error instanceof Error) {
                console.warn('Failed to drop slug column:', error.message)
            } else {
                console.warn('Failed to drop slug column:', String(error))
            }
        }
    }
}
