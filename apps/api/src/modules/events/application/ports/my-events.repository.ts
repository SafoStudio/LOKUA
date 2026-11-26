import type { AgeRestriction, Event, ParticipationStatus } from '../../domain/index.js';

export const myEventTabs = ['GOING', 'APPLICATIONS', 'ORGANIZING', 'DRAFTS', 'PAST'] as const;

export interface MyEventsQuery {
  tab: (typeof myEventTabs)[number];
  limit: number;
  cursor?: string;
}

export interface MyEventItem {
  event: Event;
  isOrganizer: boolean;
  participationStatus: ParticipationStatus | null;
  participationStatusUpdatedAt: Date | null;
}

export interface MyEventsRepository {
  findMyEvents(
    query: MyEventsQuery & {
      userId: string;
      now: Date;
      blockedOrganizerIds: string[];
      ageRestrictions: AgeRestriction[];
    }
  ): Promise<{ items: MyEventItem[]; nextCursor: string | null }>;
}
