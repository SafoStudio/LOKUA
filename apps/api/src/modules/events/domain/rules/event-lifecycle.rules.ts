import { AppError } from '../../../../common/index.js';
import type { Event } from '../models/event.js';

export function validateEventTags(tags: string[]): string[] {
  const names = tags.map((tag) => tag.trim().toLowerCase());
  if (names.length > 10 || names.some((tag) => !tag || tag.length > 30)) {
    throw new AppError('An event can have up to 10 tags of 1 to 30 characters', 422);
  }
  return [...new Set(names)];
}

export function validateEventTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new AppError('Event timezone is invalid', 422);
  }
}

export function validatePublicationDates(
  event: Pick<Event, 'firstStartsAt' | 'firstEndsAt'>,
  now: Date
): void {
  const latest = new Date(now);
  const day = latest.getUTCDate();
  latest.setUTCDate(1);
  latest.setUTCMonth(latest.getUTCMonth() + 6);
  const lastDay = new Date(latest);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  latest.setUTCDate(Math.min(day, lastDay.getUTCDate()));

  if (
    !event.firstStartsAt ||
    !event.firstEndsAt ||
    !Number.isFinite(event.firstStartsAt.getTime()) ||
    !Number.isFinite(event.firstEndsAt.getTime()) ||
    event.firstEndsAt <= event.firstStartsAt ||
    event.firstStartsAt.getTime() < now.getTime() + 3_600_000 ||
    event.firstStartsAt > latest
  ) {
    throw new AppError('Event must start between one hour and six months from now', 422);
  }
}
