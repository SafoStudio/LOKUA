import { z } from 'zod';

const feedBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');
const feedDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const mapCoordinate = (min: number, max: number) =>
  z.string().trim().min(1).pipe(z.coerce.number<string>().min(min).max(max));

const latitude = mapCoordinate(-90, 90);
const longitude = mapCoordinate(-180, 180);

const feedFilters = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  cityId: z.uuid().optional(),
  from: feedDate.optional(),
  to: feedDate.optional(),
  period: z.enum(['TODAY', 'TOMORROW', 'WEEKEND']).optional(),
  freeOnly: feedBoolean.optional(),
  participationMode: z.enum(['FREE', 'REQUEST']).optional(),
  availableOnly: feedBoolean.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  byInterests: feedBoolean.optional(),
  categoryId: z.uuid().optional(),
  format: z.enum(['OFFLINE', 'ONLINE']).optional()
});

export const getEventsQuerySchema = feedFilters
  .extend({
    sort: z.enum(['DATE', 'DISTANCE']).default('DATE'),
    latitude: latitude.optional(),
    longitude: longitude.optional()
  })
  .refine(
    (query) =>
      query.sort === 'DISTANCE'
        ? query.latitude !== undefined && query.longitude !== undefined && query.format !== 'ONLINE'
        : query.latitude === undefined && query.longitude === undefined,
    { message: 'Distance sorting requires latitude and longitude and supports only offline events' }
  )
  .transform(({ sort, latitude, longitude, ...filters }) => ({
    ...filters,
    origin:
      sort === 'DISTANCE' && latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : undefined
  }));

export const getEventsMapQuerySchema = feedFilters
  .omit({ format: true, limit: true })
  .extend({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    minLat: latitude,
    minLng: longitude,
    maxLat: latitude,
    maxLng: longitude
  })
  .refine(
    ({ minLat, minLng, maxLat, maxLng }) =>
      minLat < maxLat && minLng < maxLng && maxLat - minLat <= 5 && maxLng - minLng <= 5,
    { message: 'Map bounds must be ordered and span no more than five degrees per axis' }
  )
  .transform(({ minLat, minLng, maxLat, maxLng, ...filters }) => ({
    ...filters,
    bounds: { minLat, minLng, maxLat, maxLng }
  }));

export const getEventByIdParamsSchema = z.object({
  id: z.uuid()
});
