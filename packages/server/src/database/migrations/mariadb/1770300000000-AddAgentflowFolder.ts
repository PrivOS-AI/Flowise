import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentflowFolder1770300000000 implements MigrationInterface {
    name = 'AddAgentflowFolder1770300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create agentflow_folder table
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`agentflow_folder\` (
                \`id\` varchar(255) NOT NULL PRIMARY KEY,
                \`name\` varchar(255) NOT NULL,
                \`workspaceId\` varchar(255) NULL,
                \`createdDate\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedDate\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
        )

        // Add folderId column to chat_flow
        const tableExists = await queryRunner.hasTable('chat_flow')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`folderId\` varchar(255) NULL`)
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`agentflow_folder\``)
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`folderId\``)
    }
}
