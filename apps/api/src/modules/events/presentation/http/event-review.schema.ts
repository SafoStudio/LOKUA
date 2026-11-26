import { z } from 'zod';

const reviewText = z.string().trim().min(1).max(1000);

export const createReviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  text: reviewText.nullable().optional()
});
export const replyToReviewSchema = z.strictObject({ text: reviewText });
export const pinReviewSchema = z.strictObject({ isPinned: z.boolean() });
export const organizerProfileParamsSchema = z.object({ id: z.uuid() });
export const reviewParamsSchema = z.object({ id: z.uuid(), reviewId: z.uuid() });
export const reviewPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional()
});

export type CreateReviewBody = z.infer<typeof createReviewSchema>;
export type ReviewParams = z.infer<typeof reviewParamsSchema>;
