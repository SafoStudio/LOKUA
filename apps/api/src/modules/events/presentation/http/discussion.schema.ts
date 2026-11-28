import { z } from 'zod';
import { eventText } from './event-text.schema.js';

const commentText = eventText(1, 1000);

export const createCommentSchema = z.strictObject({
  text: commentText,
  parentId: z.uuid().optional()
});

export const editCommentSchema = z.strictObject({ text: commentText });

export const commentParamsSchema = z.object({
  id: z.uuid(),
  commentId: z.uuid()
});

export const discussionQuerySchema = z.object({
  parentId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  archive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true')
});

export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type EditCommentBody = z.infer<typeof editCommentSchema>;
export type CommentParams = z.infer<typeof commentParamsSchema>;
