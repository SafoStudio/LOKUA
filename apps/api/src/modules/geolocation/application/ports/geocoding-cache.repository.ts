import type { GeocodingCache } from '../../domain/index.js';

export interface CreateGeocodingCacheInput {
  queryHash: string;
  rawQuery: string;
  formattedAddress: string;
  city: string;
  district?: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
  provider: string;
  ttlSeconds: number;
}

export interface GeocodingCacheRepository {
  findByQueryHash(queryHash: string): Promise<GeocodingCache | null>;
  save(input: CreateGeocodingCacheInput): Promise<GeocodingCache>;
  deleteExpired(): Promise<number>;
}
