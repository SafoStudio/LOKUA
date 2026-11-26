import { describe, expect, it } from 'vitest';
import {
  validateEventTags,
  validatePublicationDates
} from '../../../src/modules/events/domain/rules/event-lifecycle.rules.js';
import { rejectApplicationBodySchema } from '../../../src/modules/events/presentation/http/participation.schema.js';

describe('publication window', () => {
  const now = new Date('2026-08-31T12:00:00Z');

  function validate(start: string) {
    const firstStartsAt = new Date(start);
    validatePublicationDates(
      { firstStartsAt, firstEndsAt: new Date(firstStartsAt.getTime() + 3_600_000) },
      now
    );
  }

  it('accepts the exact one-hour and six-calendar-month boundaries', () => {
    expect(() => validate('2026-08-31T13:00:00Z')).not.toThrow();
    expect(() => validate('2027-02-28T12:00:00Z')).not.toThrow();
  });

  it('rejects starts just outside the inclusive boundaries and missing dates', () => {
    expect(() => validate('2026-08-31T12:59:59.999Z')).toThrow();
    expect(() => validate('2027-02-28T12:00:00.001Z')).toThrow();
    expect(() =>
      validatePublicationDates({ firstStartsAt: null, firstEndsAt: null }, now)
    ).toThrow();
  });
});

describe('event tags', () => {
  it('normalizes before deduplication and caps each tag at 30 characters', () => {
    expect(validateEventTags([' Київ ', 'КИЇВ', 'A'.repeat(30)])).toEqual([
      'київ',
      'a'.repeat(30)
    ]);
    expect(() => validateEventTags(['a'.repeat(31)])).toThrow();
  });
});

describe('application rejection body', () => {
  it('accepts an absent body and rejects a reason', () => {
    expect(rejectApplicationBodySchema.safeParse(undefined).success).toBe(true);
    expect(rejectApplicationBodySchema.safeParse({ reason: 'Private' }).success).toBe(false);
  });
});
