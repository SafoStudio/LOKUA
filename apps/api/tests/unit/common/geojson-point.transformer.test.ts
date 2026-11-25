import { describe, expect, it } from 'vitest';
import { geojsonPointTransformer } from '../../../src/common/index.js';

describe('geojsonPointTransformer', () => {
  it('converts between domain coordinates and the PostgreSQL driver GeoJSON point', () => {
    const coordinates = { latitude: 50.454321, longitude: 30.524321 };
    const point = { type: 'Point', coordinates: [30.524321, 50.454321] };

    expect(geojsonPointTransformer.to(coordinates)).toEqual(point);
    expect(geojsonPointTransformer.from(point)).toEqual(coordinates);
  });

  it('preserves missing points as null', () => {
    expect(geojsonPointTransformer.to(undefined)).toBeNull();
    expect(geojsonPointTransformer.from(null)).toBeNull();
  });
});
