import type { ValueTransformer } from 'typeorm';
import type { Coordinates } from '../types/coordinates.js';

export const geojsonPointTransformer: ValueTransformer = {
  to(value: Coordinates | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return `POINT(${value.longitude} ${value.latitude})`;
  },

  from(value: string | null | undefined): Coordinates | null {
    if (value === null || value === undefined) return null;
    const match = value.match(/^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i);
    if (!match) return null;
    return {
      longitude: Number.parseFloat(match[1]),
      latitude: Number.parseFloat(match[2])
    };
  }
};
