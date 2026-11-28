import type { ParticipationStatus } from '../types/participation-status.js';
import type { ParticipationMode } from '../types/participation-mode.js';

export interface EventParticipation {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipationStatus;
  entryMode?: ParticipationMode | null;
  statusUpdatedAt: Date;
  applicationMessage?: string | null;
  removalReason?: string | null;
}
