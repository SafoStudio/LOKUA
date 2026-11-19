import { describe, it, expect, vi } from 'vitest';
import { SearchLocationsNearbyUseCase } from '../../../../src/modules/geolocation/application/index.js';
import type { LocationRepository } from '../../../../src/modules/geolocation/application/index.js';
import { InvalidCoordinatesError } from '../../../../src/modules/geolocation/index.js';

describe('SearchLocationsNearbyUseCase', () => {
  const mockLocationRepo: LocationRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    findNearby: vi.fn().mockResolvedValue([
      {
        location: {
          id: 'loc-1',
          name: 'Podil Hub',
          address: 'вул. Спаська, 10',
          cityId: 'city-kyiv',
          districtId: 'district-podilskyi',
          countryCode: 'UA',
          exactCoordinates: { latitude: 50.465, longitude: 30.518 },
          publicCoordinates: { latitude: 50.47, longitude: 30.52 },
          provider: 'manual',
          providerPlaceId: null,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        distanceMeters: 450.7
      }
    ]),
    findInBBox: vi.fn(),
    search: vi.fn()
  };

  const useCase = new SearchLocationsNearbyUseCase(mockLocationRepo, {
    defaultRadiusMeters: 1000,
    minRadiusMeters: 100,
    maxRadiusMeters: 5000,
    defaultLimit: 10,
    maxLimit: 50
  });

  it('should find nearby locations and round distance', async () => {
    const results = await useCase.execute({
      coordinates: { latitude: 50.466, longitude: 30.519 },
      radiusMeters: 1000
    });

    expect(results).toHaveLength(1);
    expect(results[0].distanceMeters).toBe(451);
    expect(results[0].location.isExact).toBe(false);
    expect(results[0].location.address).toBeUndefined();
  });

  it('should reject invalid coordinates', async () => {
    await expect(
      useCase.execute({
        coordinates: { latitude: 999, longitude: 30.5 }
      })
    ).rejects.toThrow(InvalidCoordinatesError);
  });
});
