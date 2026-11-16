import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { TransitionEntityType } from '../../../domain/index.js';

@Entity({ name: 'status_transitions' })
@Index('idx_status_transitions_unique', ['entityType', 'fromStatus', 'toStatus'], {
  unique: true
})
@Index('idx_status_transitions_lookup', ['entityType', 'fromStatus'])
export class StatusTransitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, name: 'entity_type' })
  entityType!: TransitionEntityType;

  @Column({ type: 'varchar', length: 30, name: 'from_status' })
  fromStatus!: string;

  @Column({ type: 'varchar', length: 30, name: 'to_status' })
  toStatus!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
