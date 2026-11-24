import type { AgeRestriction, EventFormat, ParticipationMode } from '../../domain/index.js';

export interface CreateEventData {
  title: string;
  categoryId: string;
  description: string;

  coverUrl?: string | null;
  mediaUrls?: string[];

  format: EventFormat;
  primaryLocationId?: string | null;
  onlineUrl?: string | null;
  hideExactAddress?: boolean;

  capacityLimit?: number | null;
  participationMode: ParticipationMode;
  ageRestriction: AgeRestriction;

  isFree: boolean;
  priceText?: string | null;

  itemsToBring?: string | null;

  firstStartsAt?: Date | null;
  firstEndsAt?: Date | null;
  timezone?: string;
}
