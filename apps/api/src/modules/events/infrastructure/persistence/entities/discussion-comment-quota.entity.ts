import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'discussion_comment_quotas' })
export class DiscussionCommentQuotaEntity {
  @PrimaryColumn({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: unknown;

  @Column({ type: 'timestamptz', array: true, name: 'posted_at' })
  postedAt!: Date[];
}
