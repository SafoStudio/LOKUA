import { describe, it, expect, vi } from 'vitest';
import { SearchLocationsInBBoxUseCase } from '../../../../src/modules/geolocation/application/index.js';
import type { LocationRepository } from '../../../../src/modules/geolocation/application/index.js';
import {
  BoundingBoxTooLargeError,
  InvalidCoordinatesError
} from '../../../../src/modules/geolocation/domain/index.js';

describe('SearchLocationsInBBoxUseCase', () => {
  const mockLocationRepo: LocationRepository = {
    findById: vi.fn(),
    districtBelongsToCity: vi.fn(),
    create: vi.fn(),
    findNearby: vi.fn(),
    findInBBox: vi.fn().mockResolvedValue([
      {
        id: 'loc-1',
        name: 'Opera House',
        address: 'вул. Володимирська, 50',
        cityId: 'city-kyiv',
        districtId: 'district-shevchenkivskyi',
        countryCode: 'UA',
        exactCoordinates: { latitude: 50.4468, longitude: 30.5126 },
        publicCoordinates: { latitude: 50.45, longitude: 30.51 },
        provider: 'manual',
        providerPlaceId: null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),
    search: vi.fn()
  };

  const useCase = new SearchLocationsInBBoxUseCase(mockLocationRepo, {
    maxBBoxSpanDegrees: 5,
    defaultLimit: 20,
    maxLimit: 100
  });

  it('should search within valid bounding box', async () => {
    const results = await useCase.execute({
      minLat: 50.4,
      minLng: 30.4,
      maxLat: 50.5,
      maxLng: 30.6
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Opera House');
    expect(results[0].isExact).toBe(false);
    expect(results[0].address).toBeUndefined();
  });

  it('should reject invalid boundaries where min >= max', async () => {
    await expect(
      useCase.execute({
        minLat: 50.5,
        minLng: 30.4,
        maxLat: 50.4, // inverted
        maxLng: 30.6
      })
    ).rejects.toThrow(InvalidCoordinatesError);
  });

  it('should reject bounding box spanning more than 5 degrees to prevent DoS', async () => {
    await expect(
      useCase.execute({
        minLat: 40.0,
        minLng: 20.0,
        maxLat: 50.0, // 10 degrees span
        maxLng: 30.0
      })
    ).rejects.toThrow(BoundingBoxTooLargeError);
  });
});
