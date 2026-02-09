/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, OneToMany } from 'typeorm'
import { IClaudeWSServer } from '../../Interface'
import { ClaudeWSPlugin } from './ClaudeWSPlugin'

/**
 * Entity representing a ClaudeWS server configuration
 * Supports room isolation - servers can be room-specific or global (shared by admin)
 */
@Entity()
export class ClaudeWSServer implements IClaudeWSServer {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ type: 'text' })
    description: string

    @Column()
    endpointUrl: string

    /**
     * Encrypted API key for ClaudeWS server authentication
     * Should be encrypted using PrivOS encryption utilities
     */
    @Column({ type: 'text' })
    apiKey: string

    @Column({ default: true })
    isActive: boolean

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    /**
     * Workspace ID - for multi-tenant isolation
     */
    @Column({ nullable: true, type: 'text' })
    workspaceId?: string

    /**
     * Room ID for room isolation
     * NULL = shared globally by admin
     * Non-null = specific to a room
     */
    @Column({ nullable: true, type: 'text' })
    roomId?: string

    /**
     * One-to-many relationship with plugins
     */
    @OneToMany(() => ClaudeWSPlugin, (plugin) => plugin.server, { cascade: true })
    plugins?: ClaudeWSPlugin[]
}
