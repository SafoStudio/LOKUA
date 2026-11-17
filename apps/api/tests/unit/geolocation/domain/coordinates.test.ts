import { describe, it, expect } from 'vitest';
import {
  isValidCoordinates,
  obfuscateCoordinates,
  toLocationView
} from '../../../../src/modules/geolocation/index.js';
import type { Location } from '../../../../src/modules/geolocation/index.js';

describe('Geolocation Domain - Coordinates & Views', () => {
  it('should validate correct coordinates', () => {
    expect(isValidCoordinates({ latitude: 50.4501, longitude: 30.5234 })).toBe(true);
    expect(isValidCoordinates({ latitude: -90, longitude: 0 })).toBe(true);
    expect(isValidCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidCoordinates({ latitude: 0, longitude: -180 })).toBe(true);
  });

  it('should reject invalid coordinates', () => {
    expect(isValidCoordinates({ latitude: 91, longitude: 30 })).toBe(false);
    expect(isValidCoordinates({ latitude: -90.1, longitude: 30 })).toBe(false);
    expect(isValidCoordinates({ latitude: 50, longitude: 181 })).toBe(false);
    expect(isValidCoordinates({ latitude: 50, longitude: -181 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 30 })).toBe(false);
  });

  it('should obfuscate coordinates to 2 decimal places for public privacy level', () => {
    const exact = { latitude: 50.4501234, longitude: 30.5234567 };
    const obfuscated = obfuscateCoordinates(exact);

    expect(obfuscated.latitude).toBe(50.45);
    expect(obfuscated.longitude).toBe(30.52);
  });

  it('should project location view correctly based on PrecisionLevel', () => {
    const mockLocation: Location = {
      id: 'loc-1',
      name: 'Art Club',
      address: 'вулиця Саксаганського, 101, кв. 5',
      city: 'Київ',
      district: 'Голосіївський',
      countryCode: 'UA',
      exactCoordinates: { latitude: 50.4356, longitude: 30.5012 },
      publicCoordinates: { latitude: 50.44, longitude: 30.5 },
      provider: 'nominatim',
      providerPlaceId: '12345',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const exactView = toLocationView(mockLocation, 'EXACT');
    expect(exactView.isExact).toBe(true);
    expect(exactView.address).toBe('вулиця Саксаганського, 101, кв. 5');
    expect(exactView.coordinates).toEqual(mockLocation.exactCoordinates);

    const publicView = toLocationView(mockLocation, 'PUBLIC');
    expect(publicView.isExact).toBe(false);
    expect(publicView.address).toBeUndefined();
    expect(publicView.coordinates).toEqual(mockLocation.publicCoordinates);
    expect(publicView.district).toBe('Голосіївський');
  });
});
