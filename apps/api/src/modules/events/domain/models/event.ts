import type { AgeRestriction } from '../types/age-restriction.js';
import type { EventFormat } from '../types/event-format.js';
import type { EventStatus } from '../types/event-status.js';
import type { ParticipationMode } from '../types/participation-mode.js';

export interface Event {
  id: string;
  organizerId: string;

  title: string;
  categoryId: string;
  description: string;

  coverUrl: string | null;
  mediaUrls: string[];

  format: EventFormat;
  primaryLocationId: string | null;
  onlineUrl: string | null;
  hideExactAddress: boolean;

  capacityLimit: number | null;
  participationMode: ParticipationMode;
  ageRestriction: AgeRestriction;

  isFree: boolean;
  priceText: string | null;
  itemsToBring: string | null;

  status: EventStatus;
  cancellationReason: string | null;
  isHiddenByAdmin: boolean;

  firstStartsAt: Date | null;
  firstEndsAt: Date | null;
  timezone: string;

  publishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
