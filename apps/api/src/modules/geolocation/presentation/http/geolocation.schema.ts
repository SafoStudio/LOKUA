import { z } from 'zod';

export const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});

export const createLocationSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().min(3),
  cityId: z.string().uuid(),
  districtId: z.string().uuid().nullable().optional(),
  countryCode: z.string().length(2).default('UA'),
  exactCoordinates: coordinatesSchema,
  publicCoordinates: coordinatesSchema.optional(),
  provider: z.string().max(50).optional(),
  providerPlaceId: z.string().max(255).nullable().optional()
});

export const getLocationParamsSchema = z.object({
  id: z.string().uuid()
});

export const getLocationQuerySchema = z.object({
  precision: z.enum(['EXACT', 'PUBLIC']).default('PUBLIC')
});

export const searchNearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive().max(100_000).optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const searchBBoxQuerySchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().positive().max(500).optional()
});

export const geocodeAddressSchema = z.object({
  address: z.string().min(3).max(500),
  city: z.string().max(100).optional()
});

export const reverseGeocodeSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});
