import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoomIdToEntities1730000000000 implements MigrationInterface {
    name = 'AddRoomIdToEntities1730000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add roomId column to chat_flow table
        await queryRunner.query(`ALTER TABLE "chat_flow" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to credential table
        await queryRunner.query(`ALTER TABLE "credential" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to tool table
        await queryRunner.query(`ALTER TABLE "tool" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to assistant table
        await queryRunner.query(`ALTER TABLE "assistant" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to execution table
        await queryRunner.query(`ALTER TABLE "execution" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to variable table
        await queryRunner.query(`ALTER TABLE "variable" ADD COLUMN "roomId" TEXT`)

        // Add roomId column to document_store table
        await queryRunner.query(`ALTER TABLE "document_store" ADD COLUMN "roomId" TEXT`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove roomId column from all tables
        await queryRunner.query(`ALTER TABLE "chat_flow" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "credential" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "tool" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "assistant" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "execution" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "variable" DROP COLUMN "roomId"`)
        await queryRunner.query(`ALTER TABLE "document_store" DROP COLUMN "roomId"`)
    }
}
