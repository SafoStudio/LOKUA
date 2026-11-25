import type { EventFormat, ParticipationMode } from '../../domain/index.js';

export interface GetEventsQuery {
  limit: number;
  cursor?: string;
  cityId?: string;
  categoryId?: string;
  format?: EventFormat;
  from?: Date;
  to?: Date;
  period?: 'TODAY' | 'TOMORROW' | 'WEEKEND';
  freeOnly?: boolean;
  participationMode?: ParticipationMode;
  availableOnly?: boolean;
  search?: string;
}
