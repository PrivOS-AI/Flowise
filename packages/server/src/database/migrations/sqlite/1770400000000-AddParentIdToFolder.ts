import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddParentIdToFolder1770400000000 implements MigrationInterface {
    name = 'AddParentIdToFolder1770400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('agentflow_folder')
        if (!tableExists) {
            return
        }

        try {
            await queryRunner.query(`ALTER TABLE "agentflow_folder" ADD COLUMN "parentId" TEXT`)
        } catch (error: any) {
            if (!error.message.includes('duplicate column name')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support DROP COLUMN
        console.warn('SQLite does not support DROP COLUMN. Column parentId will remain.')
    }
}
