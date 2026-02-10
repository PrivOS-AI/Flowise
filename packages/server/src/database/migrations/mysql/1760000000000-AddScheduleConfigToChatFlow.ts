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
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_flow' AND COLUMN_NAME = 'scheduleConfig'`
        )

        if (scheduleConfigResult.length === 0) {
            // Add scheduleConfig column
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD \`scheduleConfig\` TEXT`)
        }

        // Check if scheduleEnabled column already exists
        const scheduleEnabledResult = await queryRunner.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_flow' AND COLUMN_NAME = 'scheduleEnabled'`
        )

        if (scheduleEnabledResult.length === 0) {
            // Add scheduleEnabled column with default false
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD \`scheduleEnabled\` TINYINT DEFAULT 0`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        // Remove columns if they exist
        const scheduleConfigResult = await queryRunner.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_flow' AND COLUMN_NAME = 'scheduleConfig'`
        )
        if (scheduleConfigResult.length > 0) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`scheduleConfig\``)
        }

        const scheduleEnabledResult = await queryRunner.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_flow' AND COLUMN_NAME = 'scheduleEnabled'`
        )
        if (scheduleEnabledResult.length > 0) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`scheduleEnabled\``)
        }
    }
}
