import type { TransactionContext } from '../../../../common/index.js';
import type { Event, ParticipationStatus } from '../../domain/index.js';
import type { EventParticipation } from '../../domain/models/event-participation.js';
import type { EventManagementRepository } from './event-management.repository.js';

export interface EventParticipationRepository extends Pick<
  EventManagementRepository,
  'countApproved' | 'save' | 'syncSchedule'
> {
  inTransaction(tx: TransactionContext): EventParticipationRepository;
  findEvent(id: string): Promise<Event | null>;
  findParticipationById(eventId: string, id: string): Promise<EventParticipation | null>;
  listParticipations(query: {
    eventId: string;
    status: ParticipationStatus;
    after?: string;
    limit: number;
    excludedUserIds: string[];
  }): Promise<EventParticipation[]>;
  lockEvent(id: string): Promise<Event | null>;
  findParticipation(eventId: string, userId: string): Promise<EventParticipation | null>;
  saveParticipation(
    participation: Omit<EventParticipation, 'id'> & { id?: string }
  ): Promise<EventParticipation>;
  hasScheduleConflict(userId: string, eventId: string, start: Date, end: Date): Promise<boolean>;
}
