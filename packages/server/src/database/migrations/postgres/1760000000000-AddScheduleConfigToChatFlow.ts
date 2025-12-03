import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScheduleConfigToChatFlow1760000000000 implements MigrationInterface {
    name = 'AddScheduleConfigToChatFlow1760000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if chat_flow table exists
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return // Skip if table doesn't exist
        }

        // Check if scheduleConfig column already exists
        const scheduleConfigResult = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            ['chat_flow', 'scheduleConfig']
        )

        if (scheduleConfigResult.length === 0) {
            // Add scheduleConfig column
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "scheduleConfig" TEXT`)
        }

        // Check if scheduleEnabled column already exists
        const scheduleEnabledResult = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            ['chat_flow', 'scheduleEnabled']
        )

        if (scheduleEnabledResult.length === 0) {
            // Add scheduleEnabled column with default false
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "scheduleEnabled" BOOLEAN DEFAULT false`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        // Remove columns if they exist
        const scheduleConfigResult = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            ['chat_flow', 'scheduleConfig']
        )
        if (scheduleConfigResult.length > 0) {
            await queryRunner.query(`ALTER TABLE "chat_flow" DROP COLUMN "scheduleConfig"`)
        }

        const scheduleEnabledResult = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            ['chat_flow', 'scheduleEnabled']
        )
        if (scheduleEnabledResult.length > 0) {
            await queryRunner.query(`ALTER TABLE "chat_flow" DROP COLUMN "scheduleEnabled"`)
        }
    }
}
