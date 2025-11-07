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
                // Check if column already exists
                const tableInfo = await queryRunner.query(`PRAGMA table_info("${table.name}")`)
                const columnExists = tableInfo.some((col: any) => col.name === 'roomId')

                if (!columnExists) {
                    await queryRunner.query(`ALTER TABLE "${table.name}" ADD COLUMN "roomId" TEXT`)
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: SQLite DROP COLUMN is only supported in SQLite 3.35.0+
        // For older versions, this migration cannot be rolled back easily
        const tables = ['chat_flow', 'credential', 'tool', 'assistant', 'execution', 'variable', 'document_store']

        for (const tableName of tables) {
            const tableExists = await queryRunner.hasTable(tableName)
            if (tableExists) {
                try {
                    // Try to drop the column (works on SQLite 3.35.0+)
                    await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "roomId"`)
                } catch (error: any) {
                    // If DROP COLUMN is not supported, log a warning
                    // The column will remain but set to NULL for all rows
                    console.warn(`Could not drop roomId column from ${tableName}: ${error?.message || error}`)
                }
            }
        }
    }
}
