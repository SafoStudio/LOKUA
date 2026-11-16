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
import type { ReportObjectType, ReportStatus } from '../../../domain/index.js';

@Entity({ name: 'reports' })
@Index('idx_reports_object', ['objectType', 'objectId'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_reports_reporter_id')
  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: unknown;

  @Column({ type: 'varchar', length: 20, name: 'object_type' })
  objectType!: ReportObjectType;

  @Column({ type: 'uuid', name: 'object_id' })
  objectId!: string;

  @Column({ type: 'varchar', length: 100 })
  reason!: string;

  @Column({ type: 'varchar', length: 500 })
  text!: string;

  @Index('idx_reports_status')
  @Column({ type: 'varchar', length: 20, default: 'NEW' })
  status!: ReportStatus;

  @Index('idx_reports_moderator_id')
  @Column({ type: 'uuid', name: 'assigned_moderator_id', nullable: true })
  assignedModeratorId!: string | null;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_moderator_id' })
  assignedModerator?: unknown | null;

  @Column({ type: 'text', name: 'resolution_notes', nullable: true })
  resolutionNotes!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
