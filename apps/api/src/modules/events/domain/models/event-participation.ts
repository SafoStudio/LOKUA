import type { ParticipationStatus } from '../types/participation-status.js';

export interface EventParticipation {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipationStatus;
  statusUpdatedAt: Date;
  applicationMessage?: string | null;
  removalReason?: string | null;
}
