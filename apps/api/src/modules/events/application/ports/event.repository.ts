import type { Event } from '../../domain/index.js';
import type { CreateEventData } from '../types/create-event-data.js';
import type { AgeRestriction, EventFormat } from '../../domain/index.js';

export interface FindPublishedEventsQuery {
  limit: number;
  cursor?: string;
  categoryId?: string;
  format?: EventFormat;
  ageRestrictions: AgeRestriction[];
}

export interface FindPublishedEventsResult {
  items: Event[];
  nextCursor: string | null;
}

export interface EventRepository {
  create(organizerId: string, data: CreateEventData): Promise<Event>;

  findPublished(query: FindPublishedEventsQuery): Promise<FindPublishedEventsResult>;

  findPublishedById(id: string): Promise<Event | null>;
}
