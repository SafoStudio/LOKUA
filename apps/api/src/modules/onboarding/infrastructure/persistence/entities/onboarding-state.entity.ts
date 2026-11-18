import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique
} from 'typeorm';
import type { OnboardingStep } from '../../../domain/index.js';
import { dateTransformer } from '../../../../../common/index.js';

@Entity({ name: 'onboarding_states' })
@Unique('uq_onboarding_states_user_id', ['userId'])
export class OnboardingStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_onboarding_states_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: unknown;

  @Index('idx_onboarding_states_current_step')
  @Column({ type: 'varchar', length: 30, name: 'current_step', default: 'DATE_OF_BIRTH' })
  currentStep!: OnboardingStep;

  @Column({
    type: 'varchar',
    length: 30,
    array: true,
    name: 'completed_steps',
    default: () => "'{}'"
  })
  completedSteps!: OnboardingStep[];

  @Column({ type: 'date', name: 'date_of_birth', nullable: true, transformer: dateTransformer })
  dateOfBirth!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'text', name: 'main_photo_url', nullable: true })
  mainPhotoUrl!: string | null;

  @Column({ type: 'uuid', name: 'city_id', nullable: true })
  cityId!: string | null;

  @ManyToOne('CityEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'city_id' })
  city?: unknown;

  @Column({ type: 'uuid', array: true, name: 'interest_ids', nullable: true })
  interestIds!: string[] | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  languages!: string[] | null;

  @Column({ type: 'jsonb', name: 'social_links', nullable: true })
  socialLinks!: Record<string, string> | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
