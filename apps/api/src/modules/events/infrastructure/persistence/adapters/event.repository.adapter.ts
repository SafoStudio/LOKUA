import type { Repository, SelectQueryBuilder } from 'typeorm';
import { AppError } from '../../../../../common/index.js';
import type { Event } from '../../../domain/index.js';
import type {
  EventRepository,
  FindPublishedEventsQuery,
  FindPublishedEventsResult
} from '../../../application/index.js';
import type { CreateEventData } from '../../../application/index.js';
import { decodeEventCursor, encodeEventCursor } from '../event-cursor.js';
import type { EventCursor } from '../event-cursor.js';
import type { EventEntity } from '../entities/event.entity.js';

export class EventRepositoryAdapter implements EventRepository {
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
        status: 'PUBLISHED',
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
