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
                isActive TINYINT(1) NOT NULL DEFAULT 1,
                createdDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                workspaceId TEXT NULL,
                roomId TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
                createdDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_claude_ws_plugin_server
                    FOREIGN KEY (serverId)
                    REFERENCES claude_ws_server(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `)

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX idx_claudews_server_workspace
            ON claude_ws_server(workspaceId(255));
        `)

        await queryRunner.query(`
            CREATE INDEX idx_claudews_server_room
            ON claude_ws_server(roomId(255));
        `)

        await queryRunner.query(`
            CREATE INDEX idx_claudews_plugin_server
            ON claude_ws_plugin(serverId);
        `)

        await queryRunner.query(`
            CREATE INDEX idx_claudews_plugin_type
            ON claude_ws_plugin(type);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX idx_claudews_plugin_type ON claude_ws_plugin;`)
        await queryRunner.query(`DROP INDEX idx_claudews_plugin_server ON claude_ws_plugin;`)
        await queryRunner.query(`DROP INDEX idx_claudews_server_room ON claude_ws_server;`)
        await queryRunner.query(`DROP INDEX idx_claudews_server_workspace ON claude_ws_server;`)

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS claude_ws_plugin;`)
        await queryRunner.query(`DROP TABLE IF EXISTS claude_ws_server;`)
    }
}
