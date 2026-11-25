import type { Event } from '../../domain/index.js';
import type { CreateEventData } from '../types/create-event-data.js';
import type { AgeRestriction } from '../../domain/index.js';
import type { GetEventsQuery } from '../types/get-events-query.js';

export interface FindPublishedEventsQuery extends GetEventsQuery {
  cityId: string;
  timezone: string;
  now: Date;
  blockedOrganizerIds: string[];
  ageRestrictions: AgeRestriction[];
}

export interface FeedEvent extends Event {
  hasAvailablePlaces: boolean;
}

export interface FindPublishedEventsResult {
  items: FeedEvent[];
  nextCursor: string | null;
}

export interface EventRepository {
  create(organizerId: string, data: CreateEventData): Promise<Event>;

  findPublished(query: FindPublishedEventsQuery): Promise<FindPublishedEventsResult>;

  findPublishedById(id: string): Promise<Event | null>;
}
