import type {
  GeocodingProvider,
  GeocodingResult,
  ReverseGeocodingProvider,
  GeocodeOptions
} from '../../application/index.js';
import type { Coordinates } from '../../../../common/index.js';

export class MockGeocodingProvider implements GeocodingProvider, ReverseGeocodingProvider {
  public readonly providerName = 'mock';

  async geocode(address: string, options?: GeocodeOptions): Promise<GeocodingResult | null> {
    if (address.toLowerCase().includes('notfound')) {
      return null;
    }

    const city = options?.city ?? 'Київ';

    return {
      formattedAddress: `${address}, ${city}, Україна`,
      city,
      district: 'Шевченківський',
      countryCode: options?.countryCode?.toUpperCase() ?? 'UA',
      coordinates: {
        latitude: 50.4501,
        longitude: 30.5234
      },
      provider: this.providerName,
      providerPlaceId: 'mock-place-123'
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    return {
      formattedAddress: `вулиця Хрещатик, 22, Київ, Україна`,
      city: 'Київ',
      district: 'Печерський',
      countryCode: 'UA',
      coordinates,
      provider: this.providerName,
      providerPlaceId: 'mock-place-reverse-456'
    };
  }
}
