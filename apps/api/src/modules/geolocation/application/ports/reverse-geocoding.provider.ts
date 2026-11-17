import type { Coordinates } from '../../../../common/index.js';
import type { GeocodingResult } from './geocoding.provider.js';

export interface ReverseGeocodingProvider {
  readonly providerName: string;
  reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null>;
}
