import { z } from 'zod';
import { eventText } from './event-text.schema.js';

export const rejectApplicationBodySchema = z.strictObject({}).default({});

export const participationBodySchema = z
  .object({
    message: eventText(0, 300).optional()
  })
  .strict()
  .default({});

export const participationReasonSchema = z
  .object({
    reason: eventText(0, 300).optional()
  })
  .strict()
  .default({});

export const participationParamsSchema = z.object({
  id: z.uuid(),
  participationId: z.uuid()
});

export const participationPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional()
});

export type ParticipationBody = z.infer<typeof participationBodySchema>;
export type ParticipationReason = z.infer<typeof participationReasonSchema>;
export type ParticipationParams = z.infer<typeof participationParamsSchema>;
