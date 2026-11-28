import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { EventLocationSnapshot } from '../../../application/ports/event.repository.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { obfuscateCoordinates } from '../../../../geolocation/index.js';
import type { Location } from '../../../../geolocation/index.js';
import type { EventParticipationRepository } from '../../../application/ports/event-participation.repository.js';
import type { MyEventsRepository } from '../../../application/ports/my-events.repository.js';
import type { EventParticipation } from '../../../domain/models/event-participation.js';
import type { EventManagementRepository } from '../../../application/ports/event-management.repository.js';
import { AppError, toEntityManager } from '../../../../../common/index.js';
import type {
  Event,
  EventStatus,
  OccurrenceStatus,
  ParticipationStatus
} from '../../../domain/index.js';
import type {
  EventRepository,
  FindPublishedEventsQuery,
  FindPublishedEventsResult
} from '../../../application/index.js';
import type { CreateEventData } from '../../../application/index.js';
import {
  decodeEventCursor,
  decodeMyEventsCursor,
  encodeEventCursor,
  encodeMyEventsCursor
} from '../event-cursor.js';
import type { EventCursor } from '../event-cursor.js';
import { EventParticipationEntity } from '../entities/event-participation.entity.js';
import { EventOccurrenceEntity } from '../entities/event-occurrence.entity.js';
import { EventLocationSnapshotEntity } from '../entities/event-location-snapshot.entity.js';
import { EventTagEntity } from '../entities/event-tag.entity.js';
import { TagEntity } from '../entities/tag.entity.js';
import { EventEntity } from '../entities/event.entity.js';

interface FeedRow {
  feed_available: boolean;
  feed_start: string;
  feed_distance?: number;
  feed_latitude?: number;
  feed_longitude?: number;
  feed_district_name?: string | null;
}

interface MyEventRow {
  my_sort_at: string;
  my_participation_status: ParticipationStatus | null;
  my_participation_updated_at: Date | null;
}

const ongoingEvent = "event.status IN ('PUBLISHED', 'FULL') AND event.first_ends_at > :now";
const myEventViews = {
  GOING: {
    filter: `${ongoingEvent} AND event.organizer_id <> :userId AND participation.status = 'APPROVED'`,
    sort: 'event.first_starts_at',
    direction: 'ASC'
  },
  APPLICATIONS: {
    filter: `event.status <> 'DRAFT' AND event.organizer_id <> :userId
      AND participation.status IN ('PENDING', 'REJECTED', 'NOT_CONSIDERED')`,
    sort: 'participation.status_updated_at',
    direction: 'DESC'
  },
  ORGANIZING: {
    filter: `${ongoingEvent} AND event.organizer_id = :userId`,
    sort: 'event.first_starts_at',
    direction: 'ASC'
  },
  DRAFTS: {
    filter: "event.status = 'DRAFT' AND event.organizer_id = :userId",
    sort: 'event.updated_at',
    direction: 'DESC'
  },
  PAST: {
    filter: `(event.status IN ('COMPLETED', 'CANCELLED')
      OR (event.status IN ('PUBLISHED', 'FULL') AND event.first_ends_at <= :now))
      AND (event.organizer_id = :userId OR participation.status = 'APPROVED')`,
    sort: 'COALESCE(event.first_ends_at, event.updated_at)',
    direction: 'DESC'
  }
} as const;

const snapshotDistrict = `district.id = (
  SELECT candidate.id FROM districts candidate
  WHERE candidate.city_id = snapshot.city_id
    AND (
      ST_Covers(CAST(candidate.boundary AS geometry), CAST(snapshot.coordinates AS geometry))
      OR (candidate.boundary IS NULL AND candidate.id = snapshot.district_id)
    )
  ORDER BY (candidate.id = snapshot.district_id) DESC NULLS LAST, candidate.id
  LIMIT 1
)`;
const areaPoint = `COALESCE(
  CAST(district.center AS geometry),
  ST_SetSRID(ST_MakePoint(city.longitude, city.latitude), 4326)
)`;
const foreignPrivateSnapshot = `EXISTS (
  SELECT 1 FROM events other_event
  LEFT JOIN event_location_snapshot other_snapshot ON other_snapshot.event_id = other_event.id
  WHERE other_event.hide_exact_address
    AND other_event.organizer_id <> event.organizer_id
    AND (other_event.primary_location_id = snapshot.location_id
      OR other_snapshot.location_id = snapshot.location_id)
)`;
const publicPoint = `CASE WHEN event.hide_exact_address OR ${foreignPrivateSnapshot}
  THEN ${areaPoint} ELSE CAST(snapshot.coordinates AS geometry) END`;
const feedDistance = `ST_Distance(
  CAST((${publicPoint}) AS geography),
  CAST(ST_SetSRID(ST_MakePoint(:originLongitude, :originLatitude), 4326) AS geography)
)`;
const statusByEventStatus: Record<EventStatus, OccurrenceStatus> = {
  DRAFT: 'SCHEDULED',
  PUBLISHED: 'SCHEDULED',
  FULL: 'FULL',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export class EventRepositoryAdapter
  implements
    EventRepository,
    EventManagementRepository,
    EventParticipationRepository,
    MyEventsRepository
{
  constructor(private readonly repository: Repository<EventEntity>) {}

  async create(organizerId: string, data: CreateEventData): Promise<Event> {
    const entity = this.repository.create({
      organizerId,
      title: data.title,
      categoryId: data.categoryId,
      description: data.description,
      coverUrl: data.coverUrl ?? null,
      mediaUrls: data.mediaUrls ?? [],
      format: data.format,
      primaryLocationId: data.primaryLocationId ?? null,
      onlineUrl: data.onlineUrl ?? null,
      hideExactAddress: data.hideExactAddress ?? false,
      capacityLimit: data.capacityLimit ?? null,
      participationMode: data.participationMode,
      ageRestriction: data.ageRestriction,
      isFree: data.isFree,
      priceText: data.isFree ? null : (data.priceText ?? null),
      itemsToBring: data.itemsToBring ?? null,
      status: 'DRAFT',
      cancellationReason: null,
      isHiddenByAdmin: false,
      firstStartsAt: data.firstStartsAt ?? null,
      firstEndsAt: data.firstEndsAt ?? null,
      timezone: data.timezone ?? 'Europe/Kyiv',
      publishedAt: null
    });

    const savedEntity = await this.repository.save(entity);

    return this.toDomain(savedEntity);
  }

  inTransaction(tx: TransactionContext): EventRepositoryAdapter {
    return new EventRepositoryAdapter(toEntityManager(tx).getRepository(EventEntity));
  }

  async lockOrganizer(id: string): Promise<void> {
    await this.repository.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      'events-organizer',
      id
    ]);
  }

  async isOrganizerActive(id: string): Promise<boolean> {
    const [user] = await this.repository.query<{ status: string }[]>(
      'SELECT status FROM users WHERE id = $1',
      [id]
    );
    return user?.status === 'ACTIVE';
  }

  async lockUpcoming(organizerId: string, now: Date): Promise<Event[]> {
    const rows = await this.repository
      .createQueryBuilder('event')
      .where('event.organizerId = :organizerId', { organizerId })
      .andWhere("event.status IN ('PUBLISHED', 'FULL')")
      .andWhere('event.firstStartsAt > :now', { now })
      .orderBy('event.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findOwned(id: string, organizerId: string, lock = false): Promise<Event | null> {
    const entity = await this.repository.findOne({
      where: { id, organizerId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findEvent(id: string): Promise<Event | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async listNotificationRecipients(event: Event, includePending: boolean): Promise<string[]> {
    const statuses = includePending ? ['APPROVED', 'PENDING'] : ['APPROVED'];
    const participants = await this.repository.manager
      .getRepository(EventParticipationEntity)
      .createQueryBuilder('participation')
      .select('participation.userId', 'user_id')
      .where('participation.eventId = :eventId AND participation.userId <> :organizerId', {
        eventId: event.id,
        organizerId: event.organizerId
      })
      .andWhere('participation.status IN (:...statuses)', { statuses })
      .getRawMany<{ user_id: string }>();
    return participants.map((participant) => participant.user_id);
  }

  async hasForeignPrivateLocation(locationId: string, organizerId: string): Promise<boolean> {
    const [result] = await this.repository.query<{ restricted: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM locations
        WHERE id = $1 AND is_private AND created_by IS DISTINCT FROM $2::uuid
      ) OR EXISTS (
        SELECT 1 FROM events event
        LEFT JOIN event_location_snapshot snapshot ON snapshot.event_id = event.id
        WHERE event.organizer_id <> $2 AND event.hide_exact_address
          AND (event.primary_location_id = $1 OR snapshot.location_id = $1)
      ) AS restricted`,
      [locationId, organizerId]
    );
    return result.restricted;
  }

  findParticipationById(eventId: string, id: string): Promise<EventParticipation | null> {
    return this.repository.manager
      .getRepository(EventParticipationEntity)
      .findOneBy({ eventId, id });
  }

  listParticipations(query: {
    eventId: string;
    status: ParticipationStatus;
    after?: string;
    limit: number;
    excludedUserIds: string[];
  }): Promise<EventParticipation[]> {
    const builder = this.repository.manager
      .getRepository(EventParticipationEntity)
      .createQueryBuilder('p')
      .where('p.event_id = :eventId AND p.status = :status', {
        eventId: query.eventId,
        status: query.status
      })
      .orderBy('p.id', 'ASC')
      .take(query.limit);
    if (query.after) builder.andWhere('p.id > :after', { after: query.after });
    if (query.excludedUserIds.length) {
      builder.andWhere('p.user_id NOT IN (:...excludedUserIds)', {
        excludedUserIds: query.excludedUserIds
      });
    }
    return builder.getMany();
  }

  async lockEvent(id: string): Promise<Event | null> {
    const entity = await this.repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' }
    });
    return entity ? this.toDomain(entity) : null;
  }

  findParticipation(eventId: string, userId: string): Promise<EventParticipation | null> {
    return this.repository.manager
      .getRepository(EventParticipationEntity)
      .findOneBy({ eventId, userId });
  }

  saveParticipation(
    participation: Omit<EventParticipation, 'id'> & { id?: string }
  ): Promise<EventParticipation> {
    const repository = this.repository.manager.getRepository(EventParticipationEntity);
    return repository.save(repository.create(participation));
  }

  hasScheduleConflict(userId: string, eventId: string, start: Date, end: Date): Promise<boolean> {
    return this.repository
      .createQueryBuilder('event')
      .where('event.id <> :eventId', { eventId })
      .andWhere("event.status IN ('PUBLISHED', 'FULL')")
      .andWhere('event.first_starts_at < :end AND event.first_ends_at > :start', { start, end })
      .andWhere(
        `(event.organizer_id = :userId OR EXISTS (
          SELECT 1 FROM event_participations p
          WHERE p.event_id = event.id AND p.user_id = :userId AND p.status = 'APPROVED'
        ))`,
        { userId }
      )
      .getExists();
  }

  countUpcoming(organizerId: string, now: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('event')
      .where('event.organizerId = :organizerId', { organizerId })
      .andWhere("event.status IN ('PUBLISHED', 'FULL')")
      .andWhere('event.firstStartsAt > :now', { now })
      .getCount();
  }

  countApproved(event: Event): Promise<number> {
    return this.repository.manager
      .getRepository(EventParticipationEntity)
      .createQueryBuilder('p')
      .where('p.eventId = :id AND p.userId <> :organizerId', {
        id: event.id,
        organizerId: event.organizerId
      })
      .andWhere("p.status = 'APPROVED'")
      .getCount();
  }

  hasParticipantHistory(event: Event): Promise<boolean> {
    if (event.hasApprovedParticipants) return Promise.resolve(true);

    return this.repository.manager
      .getRepository(EventParticipationEntity)
      .createQueryBuilder('p')
      .where('p.eventId = :id AND p.userId <> :organizerId', {
        id: event.id,
        organizerId: event.organizerId
      })
      .andWhere("p.status IN ('APPROVED', 'REMOVED_BY_ORGANIZER')")
      .getExists();
  }

  hasPendingApplications(eventId: string): Promise<boolean> {
    return this.repository.manager.getRepository(EventParticipationEntity).existsBy({
      eventId,
      status: 'PENDING'
    });
  }

  async save(event: Event): Promise<Event> {
    const entity = this.repository.create(event);
    return this.toDomain(await this.repository.save(entity));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async readTags(id: string): Promise<string[]> {
    const tags = await this.repository.manager
      .getRepository(TagEntity)
      .createQueryBuilder('tag')
      .innerJoin(EventTagEntity, 'link', 'link.tagId = tag.id')
      .where('link.eventId = :id', { id })
      .orderBy('tag.name', 'ASC')
      .getMany();
    return tags.map((tag) => tag.name);
  }

  async replaceTags(id: string, tags: string[]): Promise<void> {
    const links = this.repository.manager.getRepository(EventTagEntity);
    await links.delete({ eventId: id });
    if (!tags.length) return;

    const catalog = this.repository.manager.getRepository(TagEntity);
    const names = [...tags].sort();
    await catalog
      .createQueryBuilder()
      .insert()
      .values(names.map((name) => ({ name })))
      .orIgnore()
      .execute();
    const entries = await catalog
      .createQueryBuilder('tag')
      .where('tag.name IN (:...names)', { names })
      .getMany();
    await links.insert(entries.map((tag) => ({ eventId: id, tagId: tag.id })));
  }

  async syncSchedule(event: Event, previousStart: Date | null): Promise<void> {
    if (!event.firstStartsAt || !event.firstEndsAt) return;

    const occurrences = this.repository.manager.getRepository(EventOccurrenceEntity);
    const existing = await occurrences.findOne({
      where: { eventId: event.id, startsAt: previousStart ?? event.firstStartsAt }
    });
    await occurrences.save(
      occurrences.create({
        ...existing,
        eventId: event.id,
        locationId: event.primaryLocationId,
        startsAt: event.firstStartsAt,
        endsAt: event.firstEndsAt,
        timezone: event.timezone,
        status: statusByEventStatus[event.status]
      })
    );
  }

  async replaceSnapshot(id: string, location: Location | null): Promise<void> {
    const snapshots = this.repository.manager.getRepository(EventLocationSnapshotEntity);
    if (!location) {
      await snapshots.delete({ eventId: id });
      return;
    }

    const existing = await snapshots.findOneBy({ eventId: id });
    const exact = location.exactCoordinates;
    const coordinates = {
      latitude: Number(exact.latitude.toFixed(6)),
      longitude: Number(exact.longitude.toFixed(6))
    };
    await snapshots.save(
      snapshots.create({
        ...existing,
        eventId: id,
        locationId: location.id,
        cityId: location.cityId,
        districtId: location.districtId,
        countryCode: location.countryCode,
        name: location.name,
        address: location.address,
        coordinates,
        publicCoordinates: obfuscateCoordinates(exact),
        snapshotAt: new Date()
      })
    );
  }

  async findMyEvents(query: Parameters<MyEventsRepository['findMyEvents']>[0]) {
    const { tab, userId, now, ageRestrictions, blockedOrganizerIds, limit } = query;
    const { filter, sort, direction } = myEventViews[tab];
    const builder = this.repository
      .createQueryBuilder('event')
      .leftJoin(
        EventParticipationEntity,
        'participation',
        'participation.event_id = event.id AND participation.user_id = :userId'
      )
      .where(filter, { userId, now })
      .addSelect('participation.status', 'my_participation_status')
      .addSelect('participation.status_updated_at', 'my_participation_updated_at')
      .addSelect(
        `to_char(${sort} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        'my_sort_at'
      )
      .orderBy(sort, direction)
      .addOrderBy('event.id', direction)
      .limit(limit + 1);

    if (tab !== 'ORGANIZING' && tab !== 'DRAFTS') {
      const conditions = ['event.is_hidden_by_admin = false'];
      if (ageRestrictions.length) {
        conditions.push('event.age_restriction IN (:...ageRestrictions)');
      } else {
        conditions.push('false');
      }
      if (blockedOrganizerIds.length) {
        conditions.push('event.organizer_id NOT IN (:...blockedOrganizerIds)');
      }
      builder.andWhere(`(event.organizer_id = :userId OR (${conditions.join(' AND ')}))`, {
        ageRestrictions,
        blockedOrganizerIds
      });
    }
    if (query.cursor) {
      try {
        const cursor = decodeMyEventsCursor(query.cursor, tab);
        const comparison = direction === 'ASC' ? '>' : '<';
        builder.andWhere(`(${sort}, event.id) ${comparison} (:cursorSortAt, :cursorId)`, {
          cursorSortAt: cursor.sortAt,
          cursorId: cursor.id
        });
      } catch {
        throw new AppError('Invalid cursor for the requested event view', 400);
      }
    }

    const { entities, raw } = await builder.getRawAndEntities<MyEventRow>();
    const items = entities.slice(0, limit).map((entity, index) => ({
      event: this.toDomain(entity),
      isOrganizer: entity.organizerId === userId,
      participationStatus:
        entity.organizerId === userId ? null : raw[index].my_participation_status,
      participationStatusUpdatedAt:
        entity.organizerId === userId ? null : raw[index].my_participation_updated_at
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        last && entities.length > limit
          ? encodeMyEventsCursor({ tab, sortAt: raw[limit - 1].my_sort_at, id: last.event.id })
          : null
    };
  }

  async findOrganizerHistory(query: Parameters<EventRepository['findOrganizerHistory']>[0]) {
    const { organizerId, ageRestrictions, limit, cursor } = query;
    if (ageRestrictions?.length === 0) return { items: [], nextCursor: null };

    const builder = this.repository
      .createQueryBuilder('event')
      .where('event.organizer_id = :organizerId', { organizerId })
      .andWhere("event.status = 'COMPLETED' AND event.first_ends_at IS NOT NULL")
      .andWhere('event.is_hidden_by_admin = false');
    if (ageRestrictions) {
      builder.andWhere('event.age_restriction IN (:...ageRestrictions)', { ageRestrictions });
    }
    if (cursor) {
      const anchor = this.repository
        .createQueryBuilder('anchor')
        .select('anchor.first_ends_at, anchor.id')
        .where('anchor.id = :cursor AND anchor.organizer_id = :organizerId')
        .andWhere("anchor.status = 'COMPLETED' AND anchor.is_hidden_by_admin = false");
      if (ageRestrictions) anchor.andWhere('anchor.age_restriction IN (:...ageRestrictions)');
      builder.andWhere(`(event.first_ends_at, event.id) < (${anchor.getQuery()})`, { cursor });
    }
    const rows = await builder
      .orderBy('event.first_ends_at', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .limit(limit + 1)
      .getMany();
    const items = rows.slice(0, limit).map((row) => this.toDomain(row));
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

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
          AND (lower(btrim(interest.name)) = lower(btrim(category.name)) OR EXISTS (
            SELECT 1 FROM event_tags link JOIN tags tag ON tag.id = link.tag_id
            WHERE link.event_id = event.id AND lower(btrim(tag.name)) = lower(btrim(interest.name))
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
        ...this.toDomain(entity),
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

  async findLocationSnapshot(
    eventId: string,
    locationId: string
  ): Promise<EventLocationSnapshot | null> {
    const { entities, raw } = await this.repository.manager
      .getRepository(EventLocationSnapshotEntity)
      .createQueryBuilder('snapshot')
      .innerJoin('cities', 'city', 'city.id = snapshot.city_id')
      .leftJoin('districts', 'district', snapshotDistrict)
      .where('snapshot.event_id = :eventId AND snapshot.location_id = :locationId', {
        eventId,
        locationId
      })
      .addSelect('district.id', 'area_id')
      .addSelect('district.name', 'area_name')
      .addSelect(`ST_Y(${areaPoint})`, 'area_latitude')
      .addSelect(`ST_X(${areaPoint})`, 'area_longitude')
      .getRawAndEntities<{
        area_id: string | null;
        area_name: string | null;
        area_latitude: number;
        area_longitude: number;
      }>();
    const [snapshot] = entities;
    if (!snapshot) return null;
    const [area] = raw;
    return {
      ...snapshot,
      districtId: area.area_id,
      districtName: area.area_name,
      publicCoordinates: { latitude: area.area_latitude, longitude: area.area_longitude }
    };
  }

  private toDomain(entity: EventEntity): Event {
    return {
      id: entity.id,
      organizerId: entity.organizerId,
      title: entity.title,
      categoryId: entity.categoryId,
      description: entity.description,
      coverUrl: entity.coverUrl,
      mediaUrls: entity.mediaUrls,
      format: entity.format,
      primaryLocationId: entity.primaryLocationId,
      onlineUrl: entity.onlineUrl,
      hideExactAddress: entity.hideExactAddress,
      capacityLimit: entity.capacityLimit,
      hasApprovedParticipants: entity.hasApprovedParticipants,
      participationMode: entity.participationMode,
      ageRestriction: entity.ageRestriction,
      isFree: entity.isFree,
      priceText: entity.priceText,
      itemsToBring: entity.itemsToBring,
      status: entity.status,
      cancellationReason: entity.cancellationReason,
      isHiddenByAdmin: entity.isHiddenByAdmin,
      firstStartsAt: entity.firstStartsAt,
      firstEndsAt: entity.firstEndsAt,
      timezone: entity.timezone,
      publishedAt: entity.publishedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }
}
