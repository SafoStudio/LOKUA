import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import type { ParticipationMode, ParticipationStatus } from '../../../domain/index.js';

@Entity({ name: 'event_participations' })
@Index('idx_participations_unique_pair', ['eventId', 'userId'], { unique: true })
export class EventParticipationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_participations_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne('EventEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: unknown;

  @Index('idx_participations_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: unknown;

  @Index('idx_participations_status')
  @Column({ type: 'varchar', length: 30 })
  status!: ParticipationStatus;

  @Column({ type: 'varchar', length: 10, name: 'entry_mode', nullable: true })
  entryMode!: ParticipationMode | null;

  @Column({ type: 'varchar', length: 300, name: 'application_message', nullable: true })
  applicationMessage!: string | null;

  @Column({ type: 'varchar', length: 300, name: 'removal_reason', nullable: true })
  removalReason!: string | null;

  @Column({
    type: 'timestamptz',
    name: 'status_updated_at',
    default: () => 'CURRENT_TIMESTAMP'
  })
  statusUpdatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
