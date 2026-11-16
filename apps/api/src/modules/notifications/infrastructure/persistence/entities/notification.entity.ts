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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
