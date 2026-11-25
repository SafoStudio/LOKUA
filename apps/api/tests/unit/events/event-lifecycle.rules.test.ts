import { describe, expect, it } from 'vitest';
import { validatePublicationDates } from '../../../src/modules/events/domain/rules/event-lifecycle.rules.js';

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
