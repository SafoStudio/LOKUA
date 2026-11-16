import { describe, it, expect, vi } from 'vitest';
import { CreateLocationUseCase } from '../../../../src/modules/geolocation/application/index.js';
import type { LocationRepository } from '../../../../src/modules/geolocation/application/index.js';
import { InvalidCoordinatesError } from '../../../../src/modules/geolocation/domain/index.js';

describe('CreateLocationUseCase', () => {
  const mockLocationRepo: LocationRepository = {
    findById: vi.fn(),
    create: vi.fn().mockImplementation((input) => Promise.resolve({
      id: 'mock-loc-uuid',
      ...input,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    findNearby: vi.fn(),
    findInBBox: vi.fn(),
    search: vi.fn()
  };

  const useCase = new CreateLocationUseCase(mockLocationRepo);

  it('should create location and generate public coordinates if not provided', async () => {
    const result = await useCase.execute({
      name: 'Coffee Point',
      address: 'вул. Хрещатик, 1',
      city: 'Київ',
      district: 'Печерський',
      exactCoordinates: { latitude: 50.450123, longitude: 30.523456 }
    });

    expect(result.id).toBe('mock-loc-uuid');
    expect(result.name).toBe('Coffee Point');
    expect(result.publicCoordinates).toEqual({ latitude: 50.45, longitude: 30.52 });
    expect(mockLocationRepo.create).toHaveBeenCalledOnce();
  });

  it('should throw InvalidCoordinatesError if latitude is invalid', async () => {
    await expect(
      useCase.execute({
        name: 'Invalid Point',
        address: 'Nowhere',
        city: 'Київ',
        exactCoordinates: { latitude: 100, longitude: 30 }
      })
    ).rejects.toThrow(InvalidCoordinatesError);
  });
});
