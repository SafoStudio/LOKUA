import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check
} from 'typeorm';
import type {
  EventFormat,
  EventStatus,
  ParticipationMode,
  AgeRestriction
} from '../../../domain/index.js';

@Entity({ name: 'events' })
@Check(
  'chk_events_first_dates',
  '("first_starts_at" IS NULL AND "first_ends_at" IS NULL) OR ("first_starts_at" IS NOT NULL AND "first_ends_at" IS NOT NULL AND "first_ends_at" > "first_starts_at")'
)
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_events_organizer_id')
  @Column({ type: 'uuid', name: 'organizer_id' })
  organizerId!: string;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizer_id' })
  organizer?: unknown;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Index('idx_events_category_id')
  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne('CategoryEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: unknown;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', name: 'cover_url', nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'jsonb', name: 'media_urls', default: '[]' })
  mediaUrls!: string[];

  @Column({ type: 'varchar', length: 20 })
  format!: EventFormat;

  @Index('idx_events_primary_location_id')
  @Column({ type: 'uuid', name: 'primary_location_id', nullable: true })
  primaryLocationId!: string | null;

  @ManyToOne('LocationEntity', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'primary_location_id' })
  primaryLocation?: unknown | null;

  @Column({ type: 'text', name: 'online_url', nullable: true })
  onlineUrl!: string | null;

  @Column({ type: 'boolean', name: 'hide_exact_address', default: false })
  hideExactAddress!: boolean;

  @Column({ type: 'integer', name: 'capacity_limit', nullable: true })
  capacityLimit!: number | null;

  @Column({ type: 'varchar', length: 20, name: 'participation_mode' })
  participationMode!: ParticipationMode;

  @Column({ type: 'varchar', length: 20, name: 'age_restriction' })
  ageRestriction!: AgeRestriction;

  @Column({ type: 'boolean', name: 'is_free', default: true })
  isFree!: boolean;

  @Column({ type: 'varchar', length: 100, name: 'price_text', nullable: true })
  priceText!: string | null;

  @Column({ type: 'varchar', length: 500, name: 'items_to_bring', nullable: true })
  itemsToBring!: string | null;

  @Index('idx_events_status')
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: EventStatus;

  @Column({ type: 'varchar', length: 300, name: 'cancellation_reason', nullable: true })
  cancellationReason!: string | null;

  @Column({ type: 'boolean', name: 'is_hidden_by_admin', default: false })
  isHiddenByAdmin!: boolean;

  @Index('idx_events_first_starts_at')
  @Column({ type: 'timestamptz', name: 'first_starts_at', nullable: true })
  firstStartsAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'first_ends_at', nullable: true })
  firstEndsAt!: Date | null;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Kyiv' })
  timezone!: string;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
