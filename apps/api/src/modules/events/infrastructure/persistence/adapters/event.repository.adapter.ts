import type { Repository } from 'typeorm';
import type { Event } from '../../../domain/index.js';
import type { EventRepository } from '../../../application/index.js';
import type { CreateEventData } from '../../../application/index.js';
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
