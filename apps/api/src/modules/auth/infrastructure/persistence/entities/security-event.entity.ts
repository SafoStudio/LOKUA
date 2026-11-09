import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'security_events' })
export class SecurityEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_security_events_user_id')
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Index('idx_security_events_event_type')
  @Column({ type: 'varchar', length: 64, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at'
  })
  createdAt!: Date;
}
