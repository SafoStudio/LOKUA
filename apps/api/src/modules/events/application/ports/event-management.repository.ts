import type { TransactionContext } from '../../../../common/index.js';
import type { Location } from '../../../geolocation/index.js';
import type { Event } from '../../domain/index.js';
import type { EventRepository } from './event.repository.js';

export interface EventManagementRepository {
  inTransaction(
    tx: TransactionContext
  ): EventManagementRepository & Pick<EventRepository, 'create'>;
  lockOrganizer(id: string): Promise<void>;
  findOwned(id: string, organizerId: string, lock?: boolean): Promise<Event | null>;
  countUpcoming(organizerId: string, now: Date): Promise<number>;
  countApproved(event: Event): Promise<number>;
  hasParticipantHistory(event: Event): Promise<boolean>;
  hasPendingApplications(eventId: string): Promise<boolean>;
  save(event: Event): Promise<Event>;
  delete(id: string): Promise<void>;
  readTags(id: string): Promise<string[]>;
  replaceTags(id: string, tags: string[]): Promise<void>;
  syncSchedule(event: Event, previousStart: Date | null): Promise<void>;
  replaceSnapshot(id: string, location: Location | null): Promise<void>;
}
