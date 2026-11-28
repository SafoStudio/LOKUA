import { z } from 'zod';
import { createEventSchema } from './create-event.schema.js';
import { eventText } from './event-text.schema.js';

export const updateEventSchema = createEventSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one event field is required');

export const cancelEventSchema = z
  .object({
    reason: eventText(1, 300)
  })
  .strict();

export type UpdateEventBody = z.infer<typeof updateEventSchema>;
export type CancelEventBody = z.infer<typeof cancelEventSchema>;
