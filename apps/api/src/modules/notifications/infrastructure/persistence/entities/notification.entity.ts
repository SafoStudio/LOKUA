import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import type { NotificationType } from '../../../domain/index.js';

@Entity({ name: 'notifications' })
@Index('idx_notifications_is_read', ['recipientId', 'isRead'])
@Index('idx_notifications_deduplication', ['deduplicationKey'], { unique: true })
@Index('idx_notifications_email_due', ['emailDueAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_notifications_recipient_id')
  @Column({ type: 'uuid', name: 'recipient_id' })
  recipientId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient?: unknown;

  @Column({ type: 'varchar', length: 50 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 50, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead!: boolean;

  @Column({ type: 'varchar', length: 180, name: 'deduplication_key', nullable: true })
  deduplicationKey!: string | null;

  @Column({ type: 'timestamptz', name: 'email_due_at', nullable: true })
  emailDueAt!: Date | null;

  @Column({ type: 'integer', name: 'email_attempts', default: 0 })
  emailAttempts!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
