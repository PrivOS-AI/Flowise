/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { IClaudeWSPlugin } from '../../Interface'
import { ClaudeWSServer } from './ClaudeWSServer'

/**
 * Entity representing a ClaudeWS plugin
 * Caches plugin metadata from ClaudeWS server for performance
 */
@Entity()
export class ClaudeWSPlugin implements IClaudeWSPlugin {
    @PrimaryGeneratedColumn('uuid')
    id: string

    /**
     * Foreign key to ClaudeWSServer
     */
    @Column()
    serverId: string

    /**
     * Plugin ID from ClaudeWS server
     */
    @Column()
    pluginId: string

    /**
     * Plugin type: skill | command | agent | agent_set
     */
    @Column()
    type: string

    @Column()
    name: string

    @Column({ type: 'text' })
    description: string

    @Column({ type: 'text', nullable: true })
    sourcePath?: string

    @Column({ default: 'local' })
    storageType: string

    /**
     * JSON stringified metadata from ClaudeWS
     */
    @Column({ type: 'text', nullable: true })
    metadata?: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    /**
     * Many-to-one relationship with server
     */
    @ManyToOne(() => ClaudeWSServer, (server) => server.plugins, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'serverId' })
    server: ClaudeWSServer
}
