import type { Repository, SelectQueryBuilder } from 'typeorm';
import { In } from 'typeorm';
import type { TransactionContext } from '../../../../../common/index.js';
import { obfuscateCoordinates } from '../../../../geolocation/index.js';
import type { Location } from '../../../../geolocation/index.js';
import type { EventManagementRepository } from '../../../application/ports/event-management.repository.js';
import { AppError, toEntityManager } from '../../../../../common/index.js';
import type { Event, EventStatus, OccurrenceStatus } from '../../../domain/index.js';
import type {
  EventRepository,
  FindPublishedEventsQuery,
  FindPublishedEventsResult
} from '../../../application/index.js';
import type { CreateEventData } from '../../../application/index.js';
import { decodeEventCursor, encodeEventCursor } from '../event-cursor.js';
import type { EventCursor } from '../event-cursor.js';
import { EventParticipationEntity } from '../entities/event-participation.entity.js';
import { EventOccurrenceEntity } from '../entities/event-occurrence.entity.js';
import { EventLocationSnapshotEntity } from '../entities/event-location-snapshot.entity.js';
import { EventTagEntity } from '../entities/event-tag.entity.js';
import { TagEntity } from '../entities/tag.entity.js';
import { EventEntity } from '../entities/event.entity.js';

const statusByEventStatus: Record<EventStatus, OccurrenceStatus> = {
  DRAFT: 'SCHEDULED',
  PUBLISHED: 'SCHEDULED',
  FULL: 'FULL',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export class EventRepositoryAdapter implements EventRepository, EventManagementRepository {
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

  async findOwned(id: string, organizerId: string, lock = false): Promise<Event | null> {
    const entity = await this.repository.findOne({
      where: { id, organizerId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    return entity ? this.toDomain(entity) : null;
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

  async findPublished(query: FindPublishedEventsQuery): Promise<FindPublishedEventsResult> {
    const queryBuilder = this.repository
      .createQueryBuilder('event')
      .where('event.status = :status', { status: 'PUBLISHED' })
      .andWhere('event.isHiddenByAdmin = :isHidden', { isHidden: false })
      .andWhere('event.ageRestriction IN (:...ageRestrictions)', {
        ageRestrictions: query.ageRestrictions
      });

    if (query.categoryId) {
      queryBuilder.andWhere('event.categoryId = :categoryId', {
        categoryId: query.categoryId
      });
    }

    if (query.format) {
      queryBuilder.andWhere('event.format = :format', {
        format: query.format
      });
    }

    if (query.cursor) {
      let cursor: EventCursor;

      try {
        cursor = decodeEventCursor(query.cursor);
      } catch {
        throw new AppError('Invalid cursor', 400);
      }

      this.applyCursor(queryBuilder, cursor);
    }

    const entities = await queryBuilder
      .orderBy('event.firstStartsAt', 'ASC', 'NULLS LAST')
      .addOrderBy('event.id', 'ASC')
      .take(query.limit + 1)
      .getMany();

    const hasMore = entities.length > query.limit;
    const pageEntities = hasMore ? entities.slice(0, query.limit) : entities;

    const items = pageEntities.map((entity) => this.toDomain(entity));
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor:
        hasMore && lastItem
          ? encodeEventCursor({
              id: lastItem.id,
              firstStartsAt: lastItem.firstStartsAt?.toISOString() ?? null
            })
          : null
    };
  }

  async findPublishedById(id: string): Promise<Event | null> {
    const entity = await this.repository.findOne({
      where: {
        id,
        status: In(['PUBLISHED', 'FULL']),
        isHiddenByAdmin: false
      }
    });

    return entity ? this.toDomain(entity) : null;
  }

  private applyCursor(queryBuilder: SelectQueryBuilder<EventEntity>, cursor: EventCursor): void {
    if (cursor.firstStartsAt === null) {
      queryBuilder.andWhere('event.firstStartsAt IS NULL AND event.id > :cursorId', {
        cursorId: cursor.id
      });

      return;
    }

    queryBuilder.andWhere(
      `(
        event.firstStartsAt > :cursorDate
        OR (
          event.firstStartsAt = :cursorDate
          AND event.id > :cursorId
        )
        OR event.firstStartsAt IS NULL
      )`,
      {
        cursorDate: new Date(cursor.firstStartsAt),
        cursorId: cursor.id
      }
    );
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
