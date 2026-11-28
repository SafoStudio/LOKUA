import type { Coordinates } from '../../../../common/index.js';

export interface GeocodingCache {
  id: string;
  queryHash: string;
  rawQuery: string;
  formattedAddress: string;
  city: string;
  district: string | null;
  countryCode: string;
  coordinates: Coordinates;
  provider: string;
  providerPlaceId: string | null;
  expiresAt: Date;
  createdAt: Date;
}
