import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoomIdToEntities1730000000000 implements MigrationInterface {
    name = 'AddRoomIdToEntities1730000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = [
            { name: 'chat_flow', required: true },
            { name: 'credential', required: true },
            { name: 'tool', required: true },
            { name: 'assistant', required: true },
            { name: 'execution', required: false },
            { name: 'variable', required: true },
            { name: 'document_store', required: true }
        ]

        for (const table of tables) {
            const tableExists = await queryRunner.hasTable(table.name)
            if (!tableExists && table.required) {
                continue // Skip if required table doesn't exist
            }
            if (tableExists) {
                // Check if column already exists using MySQL information_schema
                const result = await queryRunner.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                    [table.name, 'roomId']
                )

                if (result.length === 0) {
                    // Column doesn't exist, add it
                    await queryRunner.query(`ALTER TABLE \`${table.name}\` ADD \`roomId\` TEXT NULL`)
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove roomId column from all tables
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`roomId\``)
        await queryRunner.query(`ALTER TABLE \`credential\` DROP COLUMN \`roomId\``)
        await queryRunner.query(`ALTER TABLE \`tool\` DROP COLUMN \`roomId\``)
        await queryRunner.query(`ALTER TABLE \`assistant\` DROP COLUMN \`roomId\``)

        // Only drop roomId from execution table if it exists
        const executionTableExists = await queryRunner.hasTable('execution')
        if (executionTableExists) {
            await queryRunner.query(`ALTER TABLE \`execution\` DROP COLUMN \`roomId\``)
        }

        await queryRunner.query(`ALTER TABLE \`variable\` DROP COLUMN \`roomId\``)
        await queryRunner.query(`ALTER TABLE \`document_store\` DROP COLUMN \`roomId\``)
    }
}
