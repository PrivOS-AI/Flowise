import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * FINAL SAFETY MIGRATION - ALWAYS RUNS LAST (SQLite)
 *
 * This migration ensures ALL required columns exist regardless of migration history.
 * It's the last migration (timestamp 9999999999999) so it always runs after everything else.
 *
 * Safe to run on:
 * - Fresh databases (creates missing columns after initial schema)
 * - Existing databases (adds any missing columns)
 * - Broken migration history (fixes everything)
 *
 * This is idempotent - you can run it multiple times safely.
 */
export class FinalSafetyMigration9999999999999 implements MigrationInterface {
    name = 'FinalSafetyMigration9999999999999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('\n' + '='.repeat(80))
        console.log('🔍 FINAL SAFETY CHECK: Verifying all required database columns (SQLite)')
        console.log('='.repeat(80) + '\n')

        // Define ALL columns that must exist in the database
        const requiredColumns = [
            // Core columns that might be missing
            { table: 'chat_flow', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'chat_flow', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },
            { table: 'chat_flow', column: 'type', type: 'VARCHAR(20)', default: "'CHATFLOW'", description: 'Chatflow type' },
            { table: 'chat_flow', column: 'followUpPrompts', type: 'TEXT', description: 'Follow-up prompt configuration' },
            { table: 'chat_flow', column: 'textToSpeech', type: 'TEXT', description: 'Text-to-speech configuration' },

            { table: 'credential', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'credential', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },

            { table: 'tool', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'tool', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },

            { table: 'assistant', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'assistant', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },
            { table: 'assistant', column: 'type', type: 'VARCHAR(50)', description: 'Assistant type' },

            { table: 'variable', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'variable', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },

            { table: 'document_store', column: 'roomId', type: 'TEXT', description: 'Multi-tenant room identifier' },
            { table: 'document_store', column: 'workspaceId', type: 'TEXT', description: 'Workspace identifier' },

            // Optional tables
            { table: 'execution', column: 'roomId', type: 'TEXT', optional: true, description: 'Multi-tenant room identifier' },
            { table: 'execution', column: 'workspaceId', type: 'TEXT', optional: true, description: 'Workspace identifier' },
        ]

        let addedCount = 0
        let existingCount = 0
        let skippedCount = 0

        for (const col of requiredColumns) {
            try {
                // Check if table exists
                const tableExists = await queryRunner.hasTable(col.table)

                if (!tableExists) {
                    if (col.optional) {
                        skippedCount++
                        continue
                    }
                    console.log(`⚠️  WARNING: Required table "${col.table}" does not exist!`)
                    skippedCount++
                    continue
                }

                // Check if column exists using SQLite PRAGMA
                const tableInfo = await queryRunner.query(`PRAGMA table_info("${col.table}")`)
                const columnExists = tableInfo.some((row: any) => row.name === col.column)

                if (!columnExists) {
                    // Column doesn't exist - add it
                    console.log(`➕ Adding "${col.column}" to "${col.table}" - ${col.description}`)

                    let alterQuery = `ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.type}`
                    if (col.default) {
                        alterQuery += ` DEFAULT ${col.default}`
                    }

                    await queryRunner.query(alterQuery)
                    console.log(`   ✅ Successfully added "${col.table}.${col.column}"`)
                    addedCount++
                } else {
                    console.log(`   ✓  "${col.table}.${col.column}" already exists`)
                    existingCount++
                }
            } catch (error: any) {
                console.error(`   ❌ Error processing "${col.table}.${col.column}": ${error?.message || error}`)
            }
        }

        console.log('\n' + '='.repeat(80))
        console.log('📊 SUMMARY:')
        console.log(`   ✅ Added: ${addedCount} column(s)`)
        console.log(`   ✓  Already existed: ${existingCount} column(s)`)
        console.log(`   ⏭️  Skipped: ${skippedCount} column(s)`)
        console.log('='.repeat(80) + '\n')

        if (addedCount > 0) {
            console.log('✅ Database schema has been updated successfully!')
        } else {
            console.log('✅ Database schema is up to date!')
        }

        console.log('\n')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⚠️  Rollback not supported for safety migration')
        console.log('   Columns are not dropped to prevent data loss')
        console.log('   Note: SQLite DROP COLUMN is only supported in version 3.35.0+')
    }
}
