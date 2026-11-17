
import { describe, it, expect, vi } from 'vitest';
import { CreateLocationUseCase } from '../../../../src/modules/geolocation/application/index.js';
import type { LocationRepository } from '../../../../src/modules/geolocation/application/index.js';
import type {
  CityProvider,
  CountryProvider
} from '../../../../src/modules/dictionaries/index.js';
import type { UserProvider } from '../../../../src/modules/users/index.js';
import { InvalidCoordinatesError } from '../../../../src/modules/geolocation/index.js';

describe('CreateLocationUseCase', () => {
  const mockLocationRepo: LocationRepository = {
    findById: vi.fn(),
    create: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: 'mock-loc-uuid',
          ...input,
          createdAt: new Date(),
          updatedAt: new Date()
        })
    ),
    findNearby: vi.fn(),
    findInBBox: vi.fn(),
    search: vi.fn()
  };

  const mockCityProvider = {
    findById: vi.fn().mockResolvedValue({ id: 'city-kyiv' })
  } as unknown as CityProvider;

  const mockCountryProvider = {
    findByCode: vi.fn().mockResolvedValue({ code: 'UA' })
  } as unknown as CountryProvider;

  const mockUserProvider = {
    findById: vi.fn().mockResolvedValue(null)
  } as unknown as UserProvider;

  const useCase = new CreateLocationUseCase(
      mockLocationRepo,
      mockCityProvider,
      mockCountryProvider,
      mockUserProvider
  );

  it('should create location and generate public coordinates if not provided', async () => {
    const result = await useCase.execute({
      name: 'Coffee Point',
      address: 'вул. Хрещатик, 1',
      cityId: 'city-kyiv',
      districtId: null,
      exactCoordinates: { latitude: 50.450123, longitude: 30.523456 },
      createdBy: null
    });

    expect(result.id).toBe('mock-loc-uuid');
    expect(result.name).toBe('Coffee Point');
    expect(result.publicCoordinates).toEqual({
      latitude: 50.45,
      longitude: 30.52
    });

    expect(mockCityProvider.findById).toHaveBeenCalledWith('city-kyiv');
    expect(mockCountryProvider.findByCode).toHaveBeenCalledWith('UA');
    expect(mockLocationRepo.create).toHaveBeenCalledOnce();
  });

  it('should throw InvalidCoordinatesError if latitude is invalid', async () => {
    await expect(
        useCase.execute({
          name: 'Invalid Point',
          address: 'Nowhere',
          cityId: 'city-kyiv',
          districtId: null,
          exactCoordinates: { latitude: 100, longitude: 30 },
          createdBy: null
        })
    ).rejects.toThrow(InvalidCoordinatesError);

    expect(mockLocationRepo.create).not.toHaveBeenCalled();
  });
});
