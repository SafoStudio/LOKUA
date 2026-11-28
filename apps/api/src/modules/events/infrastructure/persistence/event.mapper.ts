import type { Event } from '../../domain/index.js';
import type { EventEntity } from './entities/event.entity.js';

export function toEvent(entity: EventEntity): Event {
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
