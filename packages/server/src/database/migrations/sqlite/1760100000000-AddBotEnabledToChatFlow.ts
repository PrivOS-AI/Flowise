import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBotEnabledToChatFlow1760100000000 implements MigrationInterface {
    name = 'AddBotEnabledToChatFlow1760100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "botEnabled" BOOLEAN DEFAULT 0`)
        } catch (error: any) {
            if (!error.message.includes('duplicate column name')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }
        console.warn('SQLite does not support DROP COLUMN. Column botEnabled will remain.')
    }
}
