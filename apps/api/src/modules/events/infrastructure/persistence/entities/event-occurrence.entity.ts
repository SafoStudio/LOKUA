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
import type { OccurrenceStatus } from '../../../domain/index.js';

@Entity({ name: 'event_occurrences' })
@Check('chk_event_occurrences_dates', '"ends_at" > "starts_at"')
@Index('idx_event_occurrence_unique_slot', ['eventId', 'startsAt'], { unique: true })
export class EventOccurrenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_event_occurrences_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne('EventEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: unknown;

  @Index('idx_event_occurrences_location_id')
  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

  @ManyToOne('LocationEntity', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'location_id' })
  location?: unknown | null;

  @Index('idx_event_occurrences_starts_at')
  @Column({ type: 'timestamptz', name: 'starts_at' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt!: Date;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Kyiv' })
  timezone!: string;

  @Column({ type: 'varchar', length: 20, default: 'SCHEDULED' })
  status!: OccurrenceStatus;

  @Column({ type: 'boolean', name: 'is_overridden', default: false })
  isOverridden!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
