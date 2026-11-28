import type { Coordinates } from '../../../../common/index.js';
import type { EventFormat, ParticipationMode } from '../../domain/index.js';

export interface EventMapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface GetEventsQuery {
  origin?: Coordinates;
  bounds?: EventMapBounds;
  limit: number;
  cursor?: string;
  cityId?: string;
  categoryId?: string;
  format?: EventFormat;
  from?: Date;
  to?: Date;
  period?: 'TODAY' | 'TOMORROW' | 'WEEKEND';
  freeOnly?: boolean;
  participationMode?: ParticipationMode;
  availableOnly?: boolean;
  search?: string;
  byInterests?: boolean;
}
