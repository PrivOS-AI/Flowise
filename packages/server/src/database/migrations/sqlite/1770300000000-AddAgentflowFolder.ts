import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowFolder1770300000000 implements MigrationInterface {
    name = 'AddAgentflowFolder1770300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create agentflow_folder table
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "agentflow_folder" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar NOT NULL,
                "workspaceId" text,
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now'))
            );`
        )

        // Add folderId column to chat_flow
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE "chat_flow" ADD COLUMN "folderId" TEXT`)
        } catch (error: any) {
            if (!error.message.includes('duplicate column name')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "agentflow_folder"`)
        // SQLite doesn't support DROP COLUMN
        console.warn('SQLite does not support DROP COLUMN. Column folderId will remain.')
    }
}
