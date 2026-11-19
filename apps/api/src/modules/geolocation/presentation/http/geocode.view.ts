import type { GeocodingResult } from '../../application/index.js';

export interface GeocodeView {
  formattedAddress: string;
  city: string;
  district: string | null;
  countryCode: string;
  coordinates: { latitude: number; longitude: number };
  provider: string;
  providerPlaceId: string | null;
  rawPayload: Record<string, unknown> | null;
}

export function toGeocodeView(result: GeocodingResult): GeocodeView {
  return {
    formattedAddress: result.formattedAddress,
    city: result.city,
    district: result.district,
    countryCode: result.countryCode,
    coordinates: result.coordinates,
    provider: result.provider,
    providerPlaceId: result.providerPlaceId ?? null,
    rawPayload: result.rawPayload ?? null
  };
}
