import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScheduleConfigToChatFlow1760000000000 implements MigrationInterface {
    name = 'AddScheduleConfigToChatFlow1760000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if chat_flow table exists
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return // Skip if table doesn't exist
        }

        // SQLite doesn't have easy column existence check, so we use try-catch
        try {
            // Try to add scheduleConfig column
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "scheduleConfig" TEXT`)
        } catch (error: any) {
            // Column already exists, ignore error
            if (!error.message.includes('duplicate column name')) {
                throw error
            }
        }

        try {
            // Try to add scheduleEnabled column with default false
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD "scheduleEnabled" BOOLEAN DEFAULT 0`)
        } catch (error: any) {
            // Column already exists, ignore error
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

        // SQLite doesn't support DROP COLUMN in older versions
        // This is a limitation, but we handle it gracefully
        // In production, you may want to create a new table without these columns
        // and migrate data, but for simplicity, we'll just log a warning
        console.warn('SQLite does not support DROP COLUMN. Columns scheduleConfig and scheduleEnabled will remain.')
    }
}
