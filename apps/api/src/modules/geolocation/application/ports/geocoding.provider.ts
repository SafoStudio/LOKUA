import type { Coordinates } from '../../../../common/index.js';

export interface GeocodingResult {
  formattedAddress: string;
  city: string;
  district: string | null;
  countryCode: string;
  coordinates: Coordinates;
  provider: string;
  providerPlaceId?: string;
  rawPayload?: Record<string, unknown>;
}

export interface GeocodeOptions {
  city?: string;
  countryCode?: string;
}

export interface GeocodingProvider {
  readonly providerName: string;
  geocode(address: string, options?: GeocodeOptions): Promise<GeocodingResult | null>;
}
