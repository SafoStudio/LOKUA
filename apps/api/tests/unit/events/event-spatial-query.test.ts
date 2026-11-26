import { describe, expect, it } from 'vitest';
import {
  getEventsMapQuerySchema,
  getEventsQuerySchema
} from '../../../src/modules/events/presentation/http/get-events.schema.js';

describe('event spatial query validation', () => {
  it('requires both distance coordinates and accepts the equator and prime meridian', () => {
    expect(getEventsQuerySchema.parse({
      sort: 'DISTANCE',
      latitude: '0',
      longitude: '0'
    }).origin).toEqual({ latitude: 0, longitude: 0 });
    expect(getEventsQuerySchema.safeParse({ sort: 'DISTANCE', longitude: '0' }).success)
      .toBe(false);
    expect(getEventsQuerySchema.safeParse({
      sort: 'DISTANCE',
      latitude: '0',
      longitude: '0',
      format: 'ONLINE'
    }).success).toBe(false);
  });

  it('rejects blank coordinates, reversed bounds and oversized viewports', () => {
    const bounds = { minLat: '50', minLng: '30', maxLat: '51', maxLng: '31' };
    expect(getEventsMapQuerySchema.safeParse(bounds).success).toBe(true);
    expect(getEventsMapQuerySchema.safeParse({ ...bounds, minLat: '' }).success).toBe(false);
    expect(getEventsMapQuerySchema.safeParse({ ...bounds, minLng: '32' }).success).toBe(false);
    expect(getEventsMapQuerySchema.safeParse({ ...bounds, maxLat: '56' }).success).toBe(false);
  });
});
