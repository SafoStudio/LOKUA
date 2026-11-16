import type { ReverseGeocodingProvider } from '../ports/reverse-geocoding.provider.js';
import type { GeocodingResult } from '../ports/geocoding.provider.js';
import type { Coordinates } from '../../../../common/index.js';
import { isValidCoordinates, InvalidCoordinatesError } from '../../domain/index.js';

export class ReverseGeocodeUseCase {
  constructor(private readonly reverseGeocodingProvider: ReverseGeocodingProvider) {}

  async execute(coordinates: Coordinates): Promise<GeocodingResult | null> {
    if (!isValidCoordinates(coordinates)) {
      throw new InvalidCoordinatesError();
    }

    return this.reverseGeocodingProvider.reverseGeocode(coordinates);
  }
}
