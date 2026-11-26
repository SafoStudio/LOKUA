import type { Repository } from 'typeorm';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import type { DiscussionCommentRepository } from '../../../application/ports/discussion-comment.repository.js';
import type { DiscussionComment } from '../../../domain/models/discussion-comment.js';
import { DiscussionCommentEntity } from '../entities/discussion-comment.entity.js';

export class DiscussionCommentRepositoryAdapter implements DiscussionCommentRepository {
  constructor(private readonly repository: Repository<DiscussionCommentEntity>) {}

  inTransaction(tx: TransactionContext): DiscussionCommentRepositoryAdapter {
    return new DiscussionCommentRepositoryAdapter(
      toEntityManager(tx).getRepository(DiscussionCommentEntity)
    );
  }

  find(eventId: string, id: string): Promise<DiscussionComment | null> {
    return this.repository.findOneBy({ eventId, id });
  }

  list(query: Parameters<DiscussionCommentRepository['list']>[0]): Promise<DiscussionComment[]> {
    const { eventId, parentId = null, cursor, limit, archive, excludedAuthorIds } = query;
    const builder = this.repository
      .createQueryBuilder('comment')
      .where('comment.event_id = :eventId', { eventId })
      .andWhere('comment.parent_id IS NOT DISTINCT FROM CAST(:parentId AS uuid)', { parentId })
      .orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC')
      .limit(limit);

    if (!archive) {
      builder.andWhere('NOT comment.is_archived AND NOT comment.is_hidden_by_admin');
    }
    if (excludedAuthorIds.length) {
      builder.andWhere('comment.author_id NOT IN (:...excludedAuthorIds)', { excludedAuthorIds });
    }
    if (cursor) {
      builder.andWhere(
        `(comment.created_at, comment.id) > (
           SELECT anchor.created_at, anchor.id FROM discussion_comments anchor
           WHERE anchor.id = :cursor AND anchor.event_id = :eventId
             AND anchor.parent_id IS NOT DISTINCT FROM CAST(:parentId AS uuid)
         )`,
        { cursor }
      );
    }
    return builder.getMany();
  }

  async lockAuthor(authorId: string): Promise<void> {
    await this.repository.query(
      "SELECT pg_advisory_xact_lock(hashtext('discussion-comment-quota'), hashtext($1))",
      [authorId]
    );
  }

  async consumeQuota(
    authorId: string,
    now: Date,
    windowStart: Date,
    limit: number
  ): Promise<boolean> {
    const rows: { author_id: string }[] = await this.repository.query(
      `INSERT INTO discussion_comment_quotas AS quota (author_id, posted_at)
       VALUES ($1, ARRAY[$2::timestamptz])
       ON CONFLICT (author_id) DO UPDATE
       SET posted_at = ARRAY(
         SELECT posted_time FROM unnest(quota.posted_at) AS entries(posted_time)
         WHERE posted_time > $3
       ) || EXCLUDED.posted_at
       WHERE (
         SELECT COUNT(*) FROM unnest(quota.posted_at) AS entries(posted_time)
         WHERE posted_time > $3
       ) < $4
       RETURNING author_id`,
      [authorId, now, windowStart, limit]
    );
    return rows.length === 1;
  }

  create(
    comment: Parameters<DiscussionCommentRepository['create']>[0]
  ): Promise<DiscussionComment> {
    return this.repository.save(
      this.repository.create({ ...comment, updatedAt: comment.createdAt })
    );
  }

  save(comment: DiscussionComment): Promise<DiscussionComment> {
    return this.repository.save(comment);
  }
}
