/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'
import { ITrigger } from '../../Interface'

@Entity()
export class Trigger implements ITrigger {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    flowId: string

    @Column({ type: 'varchar', length: 50, nullable: true })
    botId: string

    @Column({ type: 'text', nullable: true })
    config?: any

    @Column({ type: 'text', default: '[]' })
    events: any

    @Column({ type: 'boolean', default: true })
    isEnabled: boolean

    @Column({ nullable: true, type: 'varchar', length: 100, unique: true })
    slug?: string

    @Column({ type: 'varchar', length: 100, default: 'privos' }) // privos, cron...
    type: string

    @Column({ type: 'text', nullable: true })
    description: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @Column({ nullable: true, type: 'text' })
    workspaceId?: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    jobKey: string
}
