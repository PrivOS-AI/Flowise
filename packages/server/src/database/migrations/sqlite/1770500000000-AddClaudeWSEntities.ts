import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddClaudeWSEntities1770500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create claude_ws_server table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS claude_ws_server (
                id VARCHAR(36) PRIMARY KEY NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                endpointUrl VARCHAR(500) NOT NULL,
                apiKey TEXT NOT NULL,
                isActive BOOLEAN NOT NULL DEFAULT 1,
                createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                workspaceId TEXT NULL,
                roomId TEXT NULL
            );
        `)

        // Create claude_ws_plugin table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS claude_ws_plugin (
                id VARCHAR(36) PRIMARY KEY NOT NULL,
                serverId VARCHAR(36) NOT NULL,
                pluginId VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                sourcePath TEXT NULL,
                storageType VARCHAR(50) NOT NULL DEFAULT 'local',
                metadata TEXT NULL,
                createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (serverId) REFERENCES claude_ws_server(id) ON DELETE CASCADE
            );
        `)

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_claudews_server_workspace
            ON claude_ws_server(workspaceId);
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_claudews_server_room
            ON claude_ws_server(roomId);
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_claudews_plugin_server
            ON claude_ws_plugin(serverId);
        `)

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_claudews_plugin_type
            ON claude_ws_plugin(type);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS idx_claudews_plugin_type;`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_claudews_plugin_server;`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_claudews_server_room;`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_claudews_server_workspace;`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS claude_ws_plugin;`)
        await queryRunner.query(`DROP TABLE IF EXISTS claude_ws_server;`)
    }
}
