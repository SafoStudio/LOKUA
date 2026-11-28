import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import type { UserRole, UserStatus } from '../../../domain/index.js';
import { dateTransformer } from '../../../../../common/index.js';

@Entity('users')
@Unique('uq_users_email', ['email'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'boolean', name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ type: 'boolean', name: 'email_notifications_enabled', default: true })
  emailNotificationsEnabled!: boolean;

  @Column({ type: 'date', name: 'birth_date', nullable: true, transformer: dateTransformer })
  birthDate!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status!: UserStatus;

  @Index('idx_users_city_id')
  @Column({ type: 'uuid', name: 'city_id', nullable: true })
  cityId!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  languages!: string[] | null;

  @Column({ type: 'jsonb', name: 'social_links', nullable: true })
  socialLinks!: Record<string, string> | null;

  @Column({ type: 'boolean', name: 'onboarding_completed', default: false })
  onboardingCompleted!: boolean;

  @Column({ type: 'timestamptz', name: 'terms_accepted_at', nullable: true })
  termsAcceptedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'blocked_until', nullable: true })
  blockedUntil!: Date | null;

  @Column({ type: 'timestamptz', name: 'deletion_requested_at', nullable: true })
  deletionRequestedAt!: Date | null;

  @Column({ type: 'uuid', name: 'session_version', nullable: true })
  sessionVersion!: string | null;

  @Column({ type: 'timestamptz', name: 'media_cleanup_at', nullable: true })
  mediaCleanupAt!: Date | null;

  @Column({ type: 'jsonb', name: 'notification_settings', nullable: true })
  notificationSettings!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
