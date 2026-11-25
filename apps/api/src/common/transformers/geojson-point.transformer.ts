import type { Point, ValueTransformer } from 'typeorm';
import type { Coordinates } from '../types/coordinates.js';

export const geojsonPointTransformer: ValueTransformer = {
  to(value: Coordinates | null | undefined): Point | null {
    if (value == null) return null;
    return { type: 'Point', coordinates: [value.longitude, value.latitude] };
  },

  from(value: Point | null | undefined): Coordinates | null {
    if (value?.type !== 'Point') return null;

    const [longitude, latitude] = value.coordinates;
    return { longitude, latitude };
  }
};
