import { z } from 'zod';

const feedBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');
const feedDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const getEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  cityId: z.uuid().optional(),
  from: feedDate.optional(),
  to: feedDate.optional(),
  period: z.enum(['TODAY', 'TOMORROW', 'WEEKEND']).optional(),
  freeOnly: feedBoolean.optional(),
  participationMode: z.enum(['FREE', 'REQUEST']).optional(),
  availableOnly: feedBoolean.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  categoryId: z.uuid().optional(),
  format: z.enum(['OFFLINE', 'ONLINE']).optional()
});

export const getEventByIdParamsSchema = z.object({
  id: z.uuid()
});
