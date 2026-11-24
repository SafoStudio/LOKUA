import {
  InvalidEventDatesError,
  InvalidEventFormatError,
  InvalidEventPriceError
} from '../errors.js';

import type { EventFormat } from '../types/event-format.js';

interface CreateEventRulesData {
  firstStartsAt?: Date | null;
  firstEndsAt?: Date | null;

  format: EventFormat;
  primaryLocationId?: string | null;
  onlineUrl?: string | null;

  isFree: boolean;
  priceText?: string | null;
}

export function validateEventDates(data: CreateEventRulesData): void {
  const { firstStartsAt, firstEndsAt } = data;

  if ((firstStartsAt == null) !== (firstEndsAt == null)) {
    throw new InvalidEventDatesError('Event start and end dates must be provided together');
  }

  if (firstStartsAt && firstEndsAt) {
    if (Number.isNaN(firstStartsAt.getTime()) || Number.isNaN(firstEndsAt.getTime())) {
      throw new InvalidEventDatesError('Event dates must be valid');
    }

    if (firstEndsAt <= firstStartsAt) {
      throw new InvalidEventDatesError('Event end date must be later than start date');
    }
  }
}

export function validateEventFormat(data: CreateEventRulesData): void {
  if (data.format === 'ONLINE') {
    if (!data.onlineUrl?.trim()) {
      throw new InvalidEventFormatError('Online events must have an online URL');
    }

    if (data.primaryLocationId) {
      throw new InvalidEventFormatError('Online events cannot have a physical location');
    }

    try {
      const url = new URL(data.onlineUrl);

      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error();
      }
    } catch {
      throw new InvalidEventFormatError('Online event URL is invalid');
    }

    return;
  }

  if (data.format === 'OFFLINE') {
    if (!data.primaryLocationId) {
      throw new InvalidEventFormatError('Offline events must have a physical location');
    }

    if (data.onlineUrl) {
      throw new InvalidEventFormatError('Offline events cannot have an online URL');
    }
  }
}

export function validateEventPrice(data: CreateEventRulesData): void {
  if (data.isFree && data.priceText?.trim()) {
    throw new InvalidEventPriceError('Free events cannot have a price description');
  }

  if (!data.isFree && !data.priceText?.trim()) {
    throw new InvalidEventPriceError('Paid events must have a price description');
  }
}

export function validateCreateEvent(data: CreateEventRulesData): void {
  validateEventDates(data);
  validateEventFormat(data);
  validateEventPrice(data);
}
