import type { Event } from '../../domain/index.js';
import type { CreateEventData } from '../types/create-event-data.js';

export interface EventRepository {
  create(organizerId: string, data: CreateEventData): Promise<Event>;
}
