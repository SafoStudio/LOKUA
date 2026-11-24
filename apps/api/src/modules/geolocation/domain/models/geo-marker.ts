import type { Coordinates } from '../../../../common/index.js';
import type { EventFormat } from '../../../events/index.js';

export interface GeoMarker {
  id: string;
  occurrenceId?: string;
  title: string;
  categorySlug?: string;
  format: EventFormat;
  coordinates: Coordinates;
  isExact: boolean;
  cityId: string;
  districtId: string | null;
  startsAt: Date;
  endsAt: Date;
  freeSlots: number | null;
  isFull: boolean;
}
