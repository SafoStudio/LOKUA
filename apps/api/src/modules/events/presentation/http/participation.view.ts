import type { EventParticipation } from '../../domain/models/event-participation.js';

export function toOwnParticipationView(participation: EventParticipation) {
  return {
    id: participation.id,
    eventId: participation.eventId,
    status: participation.status,
    statusUpdatedAt: participation.statusUpdatedAt
  };
}
