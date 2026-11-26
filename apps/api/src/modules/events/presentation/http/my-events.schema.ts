import { z } from 'zod';
import { myEventTabs } from '../../application/ports/my-events.repository.js';

export const myEventsQuerySchema = z.object({
  tab: z.enum(myEventTabs),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(256).optional()
});
