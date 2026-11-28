import { z } from 'zod';

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const queryNumber = z.string().trim().min(1).transform(Number);
const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !value.includes('\0'));

export const coordinatesSchema = z.object({
  latitude,
  longitude
});

export const createLocationSchema = z.object({
  name: text(2, 255),
  address: text(3, 500),
  cityId: z.uuid(),
  districtId: z.uuid().nullable().optional(),
  countryCode: countryCode.optional(),
  exactCoordinates: coordinatesSchema,
  provider: text(1, 50).optional(),
  providerPlaceId: text(1, 255).nullable().optional()
});

export const getLocationParamsSchema = z.object({
  id: z.uuid()
});

export const getLocationQuerySchema = z.object({
  precision: z.enum(['EXACT', 'PUBLIC']).default('PUBLIC')
});

export const searchNearbyQuerySchema = z.object({
  latitude: queryNumber.pipe(latitude),
  longitude: queryNumber.pipe(longitude),
  radiusMeters: queryNumber.pipe(z.number().positive().max(100_000)).optional(),
  limit: queryNumber.pipe(z.number().int().positive().max(200)).optional()
});

export const searchBBoxQuerySchema = z.object({
  minLat: queryNumber.pipe(latitude),
  minLng: queryNumber.pipe(longitude),
  maxLat: queryNumber.pipe(latitude),
  maxLng: queryNumber.pipe(longitude),
  limit: queryNumber.pipe(z.number().int().positive().max(500)).optional()
});

export const geocodeAddressSchema = z.object({
  address: text(3, 500),
  city: text(1, 100).optional(),
  countryCode: countryCode.optional()
});

export const reverseGeocodeSchema = coordinatesSchema;
export type NearbyQuery = z.infer<typeof searchNearbyQuerySchema>;
export type BBoxQuery = z.infer<typeof searchBBoxQuerySchema>;
