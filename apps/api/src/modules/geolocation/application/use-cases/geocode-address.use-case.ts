import { createHash } from 'node:crypto';
import type { GeocodingCacheRepository } from '../ports/geocoding-cache.repository.js';
import type { GeocodingProvider, GeocodingResult } from '../ports/geocoding.provider.js';

export interface GeocodeAddressInput {
  address: string;
  city?: string;
  countryCode?: string;
}

export interface GeocodeAddressUseCaseConfig {
  cacheTtlSeconds: number;
}

export class GeocodeAddressUseCase {
  constructor(
    private readonly geocodingProvider: GeocodingProvider,
    private readonly cacheRepository: GeocodingCacheRepository,
    private readonly config: GeocodeAddressUseCaseConfig
  ) {}

  async execute(input: GeocodeAddressInput): Promise<GeocodingResult | null> {
    const address = input.address.trim();
    const city = input.city?.trim() || undefined;
    const countryCode = input.countryCode?.toUpperCase();
    const normalized = JSON.stringify([
      this.geocodingProvider.providerName,
      address.toLowerCase(),
      city?.toLowerCase(),
      countryCode
    ]);
    const queryHash = createHash('sha256').update(normalized).digest('hex');

    const cached = await this.cacheRepository.findByQueryHash(queryHash);
    if (cached && cached.expiresAt > new Date()) {
      return {
        formattedAddress: cached.formattedAddress,
        city: cached.city,
        district: cached.district,
        countryCode: cached.countryCode,
        coordinates: cached.coordinates,
        provider: cached.provider,
        providerPlaceId: cached.providerPlaceId ?? undefined
      };
    }

    const result = await this.geocodingProvider.geocode(address, { city, countryCode });
    if (!result) {
      return null;
    }

    await this.cacheRepository.save({
      queryHash,
      rawQuery: address,
      formattedAddress: result.formattedAddress,
      city: result.city,
      district: result.district,
      countryCode: result.countryCode,
      latitude: result.coordinates.latitude,
      longitude: result.coordinates.longitude,
      provider: result.provider,
      providerPlaceId: result.providerPlaceId,
      ttlSeconds: this.config.cacheTtlSeconds
    });

    return result;
  }
}
