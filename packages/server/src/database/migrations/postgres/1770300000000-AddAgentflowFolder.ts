import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowFolder1770300000000 implements MigrationInterface {
    name = 'AddAgentflowFolder1770300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create agentflow_folder table
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "agentflow_folder" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar NOT NULL,
                "workspaceId" varchar,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now()
            );`
        )

        // Add folderId column to chat_flow
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE chat_flow ADD COLUMN "folderId" varchar`)
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('column "folderId" of relation "chat_flow" already exists')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "agentflow_folder"`)
        await queryRunner.query(`ALTER TABLE chat_flow DROP COLUMN IF EXISTS "folderId"`)
    }
}
