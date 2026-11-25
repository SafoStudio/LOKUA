import type { FeedEvent } from '../../application/index.js';
import type { Event } from '../../domain/index.js';

export function toEventView(event: Event) {
  return {
    id: event.id,
    organizerId: event.organizerId,
    tags: event.tags ?? [],
    title: event.title,
    categoryId: event.categoryId,
    description: event.description,
    coverUrl: event.coverUrl,
    mediaUrls: event.mediaUrls,
    format: event.format,
    primaryLocationId: event.primaryLocationId,
    onlineUrl: event.onlineUrl,
    hideExactAddress: event.hideExactAddress,
    capacityLimit: event.capacityLimit,
    participationMode: event.participationMode,
    ageRestriction: event.ageRestriction,
    isFree: event.isFree,
    priceText: event.priceText,
    itemsToBring: event.itemsToBring,
    status: event.status,
    cancellationReason: event.cancellationReason,
    isHiddenByAdmin: event.isHiddenByAdmin,
    firstStartsAt: event.firstStartsAt,
    firstEndsAt: event.firstEndsAt,
    timezone: event.timezone,
    publishedAt: event.publishedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}

export function toPublicEventView(event: Event) {
  return {
    id: event.id,
    title: event.title,
    categoryId: event.categoryId,
    description: event.description,
    coverUrl: event.coverUrl,
    mediaUrls: event.mediaUrls,
    format: event.format,
    capacityLimit: event.capacityLimit,
    participationMode: event.participationMode,
    ageRestriction: event.ageRestriction,
    isFree: event.isFree,
    priceText: event.priceText,
    itemsToBring: event.itemsToBring,
    firstStartsAt: event.firstStartsAt,
    firstEndsAt: event.firstEndsAt,
    timezone: event.timezone,
    publishedAt: event.publishedAt,
    createdAt: event.createdAt
  };
}

export function toFeedEventView(event: FeedEvent) {
  return {
    ...toPublicEventView(event),
    status: event.status,
    hasAvailablePlaces: event.hasAvailablePlaces
  };
}
