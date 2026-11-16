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

@Entity({ name: 'event_reviews' })
@Index('idx_event_reviews_unique_pair', ['eventId', 'authorId'], { unique: true })
@Check('chk_event_reviews_rating', '"rating" >= 1 AND "rating" <= 5')
export class EventReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_event_reviews_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne('EventEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: unknown;

  @Index('idx_event_reviews_author_id')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: unknown;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  text!: string | null;

  @Column({ type: 'varchar', length: 1000, name: 'organizer_reply', nullable: true })
  organizerReply!: string | null;

  @Column({ type: 'timestamptz', name: 'organizer_reply_at', nullable: true })
  organizerReplyAt!: Date | null;

  @Column({ type: 'boolean', name: 'is_pinned', default: false })
  isPinned!: boolean;

  @Column({ type: 'boolean', name: 'is_hidden_by_admin', default: false })
  isHiddenByAdmin!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
