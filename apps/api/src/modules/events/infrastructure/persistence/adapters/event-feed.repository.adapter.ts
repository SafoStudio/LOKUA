import type { Repository, SelectQueryBuilder } from 'typeorm';
import { AppError } from '../../../../../common/index.js';
import type {
  EventFeedRepository,
  FindPublishedEventsQuery,
  FindPublishedEventsResult
} from '../../../application/ports/event.repository.js';
import { decodeEventCursor, encodeEventCursor } from '../event-cursor.js';
import type { EventCursor } from '../event-cursor.js';
import { areaPoint, foreignPrivateLocation, snapshotDistrict } from '../event-location-query.js';
import { toEvent } from '../event.mapper.js';
import type { EventEntity } from '../entities/event.entity.js';
import { EventLocationSnapshotEntity } from '../entities/event-location-snapshot.entity.js';

interface FeedRow {
  feed_available: boolean;
  feed_start: string;
  feed_distance?: number;
  feed_latitude?: number;
  feed_longitude?: number;
  feed_district_name?: string | null;
}

const foreignPrivateSnapshot = foreignPrivateLocation('snapshot.location_id', 'event.organizer_id');
const publicPoint = `CASE WHEN event.hide_exact_address OR ${foreignPrivateSnapshot}
  THEN ${areaPoint} ELSE CAST(snapshot.coordinates AS geometry) END`;
const feedDistance = `ST_Distance(
  CAST((${publicPoint}) AS geography),
  CAST(ST_SetSRID(ST_MakePoint(:originLongitude, :originLatitude), 4326) AS geography)
)`;

export class EventFeedRepositoryAdapter implements EventFeedRepository {
  constructor(private readonly repository: Repository<EventEntity>) {}

  async findPublished(query: FindPublishedEventsQuery): Promise<FindPublishedEventsResult> {
    let cursor: EventCursor | undefined;
    if (query.cursor) {
      try {
        cursor = decodeEventCursor(query.cursor);
      } catch {
        throw new AppError('Invalid cursor', 400);
      }
    }
    if (
      cursor &&
      ((cursor.source === 'MAP') !== Boolean(query.bounds) ||
        (cursor.distanceMeters !== undefined) !== Boolean(query.origin) ||
        (cursor.distanceMeters !== undefined && cursor.source !== 'CITY'))
    ) {
      throw new AppError('Invalid cursor for the requested event view', 400);
    }
    if (
      !query.ageRestrictions.length ||
      query.interestIds?.length === 0 ||
      cursor?.firstStartsAt === null
    ) {
      return { items: [], nextCursor: null };
    }

    const availability = `(
      event.status = 'PUBLISHED' AND (
        event.capacity_limit IS NULL OR event.capacity_limit > (
          SELECT COUNT(*) FROM event_participations p
          WHERE p.event_id = event.id AND p.status = 'APPROVED'
            AND p.user_id <> event.organizer_id
        )
      )
    )`;
    const builder = this.repository
      .createQueryBuilder('event')
      .where("event.status IN ('PUBLISHED', 'FULL')")
      .andWhere('event.first_starts_at > :feedNow', { feedNow: query.now })
      .andWhere('event.is_hidden_by_admin = false')
      .andWhere('event.age_restriction IN (:...ageRestrictions)', {
        ageRestrictions: query.ageRestrictions
      })
      .addSelect(availability, 'feed_available')
      .addSelect(
        `to_char(event.first_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        'feed_start'
      )
      .orderBy('event.firstStartsAt', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .limit(query.limit + 1);

    if (query.blockedOrganizerIds.length) {
      builder.andWhere('event.organizer_id NOT IN (:...blockedOrganizerIds)', {
        blockedOrganizerIds: query.blockedOrganizerIds
      });
    }
    if (query.categoryId) {
      builder.andWhere('event.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query.interestIds) {
      builder.andWhere(
        `EXISTS (
        SELECT 1 FROM interests interest
        JOIN categories category ON category.id = event.category_id
        WHERE interest.id IN (:...interestIds) AND interest.is_active
          AND (interest.feed_key = category.feed_key OR EXISTS (
            SELECT 1 FROM event_tags link JOIN tags tag ON tag.id = link.tag_id
            WHERE link.event_id = event.id AND tag.feed_key = interest.feed_key
          ))
      )`,
        { interestIds: query.interestIds }
      );
    }
    if (query.format) {
      builder.andWhere('event.format = :format', { format: query.format });
    }
    if (query.participationMode) {
      builder.andWhere('event.participation_mode = :participationMode', {
        participationMode: query.participationMode
      });
    }
    if (query.freeOnly) builder.andWhere('event.is_free = true');
    if (query.availableOnly) builder.andWhere(availability);
    if (query.from) builder.andWhere('event.first_starts_at >= :from', { from: query.from });
    if (query.to) builder.andWhere('event.first_starts_at < :to', { to: query.to });
    if (query.period) this.applyFeedPeriod(builder, query);
    if (query.search) {
      builder.andWhere(
        `(
          strpos(lower(event.title), lower(:search)) > 0 OR
          strpos(lower(event.description), lower(:search)) > 0 OR EXISTS (
            SELECT 1 FROM event_tags link JOIN tags tag ON tag.id = link.tag_id
            WHERE link.event_id = event.id AND strpos(lower(tag.name), lower(:search)) > 0
          )
        )`,
        { search: query.search }
      );
    }
    if (cursor && !query.origin) {
      builder.andWhere('(event.first_starts_at, event.id) > (:cursorStart, :cursorId)', {
        cursorStart: cursor.firstStartsAt,
        cursorId: cursor.id
      });
    }

    const run = (source: 'CITY' | 'ONLINE' | 'MAP') => {
      const scoped = builder.clone();
      if (source === 'ONLINE') {
        scoped.andWhere("event.format = 'ONLINE'");
      } else if (query.bounds || query.origin) {
        scoped
          .innerJoin(EventLocationSnapshotEntity, 'snapshot', 'snapshot.event_id = event.id')
          .innerJoin('cities', 'city', 'city.id = snapshot.city_id')
          .leftJoin('districts', 'district', snapshotDistrict)
          .andWhere("event.format = 'OFFLINE'");
        if (query.cityId) {
          scoped.andWhere('snapshot.city_id = :cityId', { cityId: query.cityId });
        }
        if (query.bounds) this.applyMapBounds(scoped, query.bounds);
        if (query.origin) {
          scoped
            .setParameters({
              originLongitude: query.origin.longitude,
              originLatitude: query.origin.latitude
            })
            .addSelect(feedDistance, 'feed_distance')
            .orderBy('feed_distance', 'ASC')
            .addOrderBy('event.firstStartsAt', 'ASC')
            .addOrderBy('event.id', 'ASC');
          if (cursor) {
            scoped.andWhere(
              `(${feedDistance}, event.first_starts_at, event.id) >
                (:cursorDistance, :cursorStart, :cursorId)`,
              {
                cursorDistance: cursor.distanceMeters,
                cursorStart: cursor.firstStartsAt,
                cursorId: cursor.id
              }
            );
          }
        }
      } else {
        scoped.andWhere(
          `event.format = 'OFFLINE' AND EXISTS (
            SELECT 1 FROM event_location_snapshot snapshot
            WHERE snapshot.event_id = event.id AND snapshot.city_id = :cityId
          )`,
          { cityId: query.cityId }
        );
      }
      return scoped.getRawAndEntities<FeedRow>();
    };

    let source: 'CITY' | 'ONLINE' | 'MAP' = query.bounds
      ? 'MAP'
      : query.format === 'ONLINE'
        ? 'ONLINE'
        : (cursor?.source ?? 'CITY');
    let page = await run(source);
    if (!cursor && !query.format && !query.bounds && !query.origin && !page.entities.length) {
      source = 'ONLINE';
      page = await run(source);
    }

    const items = page.entities.slice(0, query.limit).map((entity, index) => {
      const row = page.raw[index];
      return {
        ...toEvent(entity),
        hasAvailablePlaces: row.feed_available,
        distanceMeters: row.feed_distance,
        districtName: row.feed_district_name,
        mapCoordinates:
          row.feed_latitude === undefined || row.feed_longitude === undefined
            ? undefined
            : { latitude: row.feed_latitude, longitude: row.feed_longitude }
      };
    });
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        last && page.entities.length > query.limit
          ? encodeEventCursor({
              id: last.id,
              firstStartsAt: page.raw[items.length - 1].feed_start,
              distanceMeters: last.distanceMeters,
              source
            })
          : null
    };
  }

  private applyMapBounds(
    builder: SelectQueryBuilder<EventEntity>,
    bounds: NonNullable<FindPublishedEventsQuery['bounds']>
  ): void {
    const point = `(${publicPoint})`;
    const envelope = 'ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)';
    builder
      .andWhere(`ST_Intersects(${point}, ${envelope})`, { ...bounds })
      .addSelect('district.name', 'feed_district_name')
      .addSelect(`ST_Y(${point})`, 'feed_latitude')
      .addSelect(`ST_X(${point})`, 'feed_longitude');
  }

  private applyFeedPeriod(
    builder: SelectQueryBuilder<EventEntity>,
    query: FindPublishedEventsQuery
  ): void {
    const today =
      'CAST(timezone(CAST(:feedTimezone AS text), CAST(:feedNow AS timestamptz)) AS date)';
    const eventDay = 'CAST(timezone(CAST(:feedTimezone AS text), event.first_starts_at) AS date)';
    builder.setParameter('feedTimezone', query.timezone);
    if (query.period === 'WEEKEND') {
      const weekday = `CAST(EXTRACT(ISODOW FROM ${today}) AS integer)`;
      const saturday = `(${today} + 6 - ${weekday})`;
      builder.andWhere(`${eventDay} BETWEEN ${saturday} AND (${saturday} + 1)`);
    } else {
      const offset = query.period === 'TOMORROW' ? 1 : 0;
      builder.andWhere(`${eventDay} = (${today} + CAST(:dayOffset AS integer))`, {
        dayOffset: offset
      });
    }
  }
}
