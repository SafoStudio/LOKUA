import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_audit_logs_actor_id')
  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor?: unknown;

  @Index('idx_audit_logs_action')
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Index('idx_audit_logs_target', ['targetType', 'targetId'])
  @Column({ type: 'varchar', length: 50, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'jsonb', name: 'before_state', nullable: true })
  beforeState!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'after_state', nullable: true })
  afterState!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @Index('idx_audit_logs_created_at')
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
