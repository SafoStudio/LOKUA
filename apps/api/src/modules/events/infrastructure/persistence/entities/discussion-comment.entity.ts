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

@Entity({ name: 'discussion_comments' })
export class DiscussionCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_discussion_comments_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne('EventEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: unknown;

  @Index('idx_discussion_comments_author_id')
  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: unknown;

  @Index('idx_discussion_comments_parent_id')
  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @ManyToOne('DiscussionCommentEntity', {
    onDelete: 'CASCADE',
    nullable: true
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: unknown | null;

  @Column({ type: 'varchar', length: 1000 })
  text!: string;

  @Column({ type: 'boolean', name: 'is_edited', default: false })
  isEdited!: boolean;

  @Column({ type: 'boolean', name: 'is_archived', default: false })
  isArchived!: boolean;

  @Column({ type: 'boolean', name: 'is_hidden_by_admin', default: false })
  isHiddenByAdmin!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
