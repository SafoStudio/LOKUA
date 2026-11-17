import { describe, it, expect, vi } from 'vitest';
import { GeocodeAddressUseCase } from '../../../../src/modules/geolocation/application/index.js';
import type {
  GeocodingCacheRepository,
  GeocodingProvider
} from '../../../../src/modules/geolocation/application/index.js';

describe('GeocodeAddressUseCase', () => {
  it('should return cached geocoding result without calling provider if valid cache exists', async () => {
    const mockProvider: GeocodingProvider = {
      providerName: 'test-provider',
      geocode: vi.fn()
    };

    const mockCacheRepo: GeocodingCacheRepository = {
      findByQueryHash: vi.fn().mockResolvedValue({
        id: 'cache-1',
        queryHash: 'hash-123',
        rawQuery: 'вул. Хрещатик, 22',
        formattedAddress: 'вулиця Хрещатик, 22, Київ, Україна',
        city: 'Київ',
        district: 'Печерський',
        countryCode: 'UA',
        coordinates: { latitude: 50.4501, longitude: 30.5234 },
        provider: 'nominatim',
        expiresAt: new Date(Date.now() + 86400 * 1000), // future
        createdAt: new Date()
      }),
      save: vi.fn(),
      deleteExpired: vi.fn()
    };

    const useCase = new GeocodeAddressUseCase(mockProvider, mockCacheRepo, {
      cacheTtlSeconds: 86400
    });

    const result = await useCase.execute({
      address: 'вул. Хрещатик, 22',
      city: 'Київ'
    });

    expect(result).not.toBeNull();
    expect(result?.formattedAddress).toBe('вулиця Хрещатик, 22, Київ, Україна');
    expect(mockProvider.geocode).not.toHaveBeenCalled();
  });

  it('should call geocoding provider and save to cache if not cached', async () => {
    const mockProvider: GeocodingProvider = {
      providerName: 'nominatim',
      geocode: vi.fn().mockResolvedValue({
        formattedAddress: 'вулиця Спаська, 5, Київ, Україна',
        city: 'Київ',
        district: 'Подільський',
        countryCode: 'UA',
        coordinates: { latitude: 50.465, longitude: 30.518 },
        provider: 'nominatim'
      })
    };

    const mockCacheRepo: GeocodingCacheRepository = {
      findByQueryHash: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((input) => Promise.resolve({
        id: 'cache-new',
        ...input,
        coordinates: { latitude: input.latitude, longitude: input.longitude },
        expiresAt: new Date(Date.now() + 86400 * 1000),
        createdAt: new Date()
      })),
      deleteExpired: vi.fn()
    };

    const useCase = new GeocodeAddressUseCase(mockProvider, mockCacheRepo, {
      cacheTtlSeconds: 86400
    });

    const result = await useCase.execute({
      address: 'вул. Спаська, 5',
      city: 'Київ'
    });

    expect(result).not.toBeNull();
    expect(result?.city).toBe('Київ');
    expect(mockProvider.geocode).toHaveBeenCalledOnce();
    expect(mockCacheRepo.save).toHaveBeenCalledOnce();
  });
});
