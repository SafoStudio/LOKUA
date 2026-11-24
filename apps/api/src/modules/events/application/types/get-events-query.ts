import type { EventFormat } from '../../domain/index.js';

export interface GetEventsQuery {
  limit: number;
  cursor?: string;
  categoryId?: string;
  format?: EventFormat;
}
