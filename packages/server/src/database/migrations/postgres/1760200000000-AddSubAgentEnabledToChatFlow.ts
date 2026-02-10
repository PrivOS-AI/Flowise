import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSubAgentEnabledToChatFlow1760200000000 implements MigrationInterface {
    name = 'AddSubAgentEnabledToChatFlow1760200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow ADD COLUMN "subAgentEnabled" BOOLEAN DEFAULT false`)
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('column "subAgentEnabled" of relation "chat_flow" already exists')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow DROP COLUMN "subAgentEnabled"`)
        } catch (error) {
            if (error instanceof Error) {
                console.warn('Failed to drop subAgentEnabled column:', error.message)
            } else {
                console.warn('Failed to drop subAgentEnabled column:', String(error))
            }
        }
    }
}
