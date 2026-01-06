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
            if (!error.message.includes('duplicate column name') && !error.message.includes('column already exists')) {
                throw error
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('agentflow_folder')
        if (!tableExists) {
            return
        }
        await queryRunner.query(`ALTER TABLE "agentflow_folder" DROP COLUMN "parentId"`)
    }
}
