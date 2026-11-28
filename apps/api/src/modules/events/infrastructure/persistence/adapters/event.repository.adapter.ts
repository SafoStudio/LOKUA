import type { Repository } from 'typeorm';
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
import type { EventRepository } from '../../../application/index.js';
import type { CreateEventData } from '../../../application/index.js';
import { decodeMyEventsCursor, encodeMyEventsCursor } from '../event-cursor.js';
import { areaPoint, foreignPrivateLocation, snapshotDistrict } from '../event-location-query.js';
import { toEvent } from '../event.mapper.js';
import { EventParticipationEntity } from '../entities/event-participation.entity.js';
import { EventOccurrenceEntity } from '../entities/event-occurrence.entity.js';
import { EventLocationSnapshotEntity } from '../entities/event-location-snapshot.entity.js';
import { EventTagEntity } from '../entities/event-tag.entity.js';
import { TagEntity } from '../entities/tag.entity.js';
import { EventEntity } from '../entities/event.entity.js';

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

    return toEvent(savedEntity);
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
    return rows.map((row) => toEvent(row));
  }

  async findOwned(id: string, organizerId: string, lock = false): Promise<Event | null> {
    const entity = await this.repository.findOne({
      where: { id, organizerId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    return entity ? toEvent(entity) : null;
  }

  async findEvent(id: string): Promise<Event | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? toEvent(entity) : null;
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
      `SELECT (${foreignPrivateLocation('$1', '$2')}) AS restricted`,
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
    return entity ? toEvent(entity) : null;
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
    return toEvent(await this.repository.save(entity));
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
      event: toEvent(entity),
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
    const items = rows.slice(0, limit).map((row) => toEvent(row));
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
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
}
