import { z } from 'zod';

export const getEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  categoryId: z.uuid().optional(),
  format: z.enum(['OFFLINE', 'ONLINE']).optional()
});

export const getEventByIdParamsSchema = z.object({
  id: z.uuid()
});
