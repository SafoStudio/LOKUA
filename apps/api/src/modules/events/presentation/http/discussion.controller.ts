import type { Request, Response } from 'express';
import type { DiscussionQuery } from '../../application/ports/discussion-comment.repository.js';
import type { EventDiscussionUseCase } from '../../application/use-cases/event-discussion.use-case.js';
import type { DiscussionComment } from '../../domain/models/discussion-comment.js';
import type { CommentParams, CreateCommentBody, EditCommentBody } from './discussion.schema.js';
import { toEventContext } from './event-context.js';

interface DiscussionItem {
  comment: DiscussionComment;
  author: { id: string; name: string | null; avatarUrl: string | null } | null;
  isOrganizer: boolean;
}

function toCommentView({ comment, author, isOrganizer }: DiscussionItem) {
  return {
    id: comment.id,
    parentId: comment.parentId,
    author,
    isOrganizer,
    text: comment.text,
    isEdited: comment.isEdited,
    isArchived: comment.isArchived,
    isHiddenByAdmin: comment.isHiddenByAdmin,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

export function createDiscussionController(discussion: EventDiscussionUseCase) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      const query = req.query as unknown as DiscussionQuery;
      res.set('Cache-Control', 'private, no-store');
      const { items, nextCursor } = await discussion.list(id, req.user ?? null, query);
      res.json({
        data: items.map(toCommentView),
        pagination: { nextCursor, hasMore: nextCursor !== null }
      });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      const { text, parentId } = req.body as CreateCommentBody;
      const item = await discussion.create(toEventContext(req).user, id, text, parentId);
      res.status(201).json({ data: toCommentView(item) });
    },

    async edit(req: Request, res: Response): Promise<void> {
      const { id, commentId } = req.params as CommentParams;
      const { text } = req.body as EditCommentBody;
      const item = await discussion.edit(toEventContext(req).user, id, commentId, text);
      res.json({ data: toCommentView(item) });
    },

    async remove(req: Request, res: Response): Promise<void> {
      const { id, commentId } = req.params as CommentParams;
      await discussion.remove(toEventContext(req).user, id, commentId);
      res.status(204).end();
    }
  };
}

export type DiscussionController = ReturnType<typeof createDiscussionController>;
