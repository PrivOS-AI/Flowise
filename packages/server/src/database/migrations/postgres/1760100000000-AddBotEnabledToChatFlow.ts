import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBotEnabledToChatFlow1760100000000 implements MigrationInterface {
    name = 'AddBotEnabledToChatFlow1760100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const columnExists = await queryRunner.hasColumn('chat_flow', 'botEnabled')
        if (!columnExists) {
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "botEnabled" BOOLEAN DEFAULT false`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const columnExists = await queryRunner.hasColumn('chat_flow', 'botEnabled')
        if (columnExists) {
            await queryRunner.query(`ALTER TABLE "chat_flow" DROP COLUMN "botEnabled"`)
        }
    }
}
