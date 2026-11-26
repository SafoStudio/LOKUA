import type { TransactionContext } from '../../../../common/index.js';
import type { DiscussionComment } from '../../domain/models/discussion-comment.js';

export interface DiscussionQuery {
  parentId?: string;
  cursor?: string;
  limit: number;
  archive: boolean;
}

export interface DiscussionCommentRepository {
  inTransaction(tx: TransactionContext): DiscussionCommentRepository;
  find(eventId: string, id: string): Promise<DiscussionComment | null>;
  list(
    query: DiscussionQuery & { eventId: string; excludedAuthorIds: string[] }
  ): Promise<DiscussionComment[]>;
  lockAuthor(authorId: string): Promise<void>;
  consumeQuota(authorId: string, now: Date, windowStart: Date, limit: number): Promise<boolean>;
  create(
    comment: Pick<DiscussionComment, 'eventId' | 'authorId' | 'parentId' | 'text' | 'createdAt'>
  ): Promise<DiscussionComment>;
  save(comment: DiscussionComment): Promise<DiscussionComment>;
}
