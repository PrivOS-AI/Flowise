/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'
import { IAgentflowFolder } from '../../Interface'

@Entity()
export class AgentflowFolder implements IAgentflowFolder {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ nullable: true, type: 'text' })
    workspaceId: string | null

    @Column({ nullable: true, type: 'text' })
    parentId: string | null

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date
}
