import type { FeedEvent, GetEventByIdUseCase } from '../../application/index.js';
import type { MyEventItem } from '../../application/ports/my-events.repository.js';
import type { Event } from '../../domain/index.js';
import { toReviewPageView } from './event-review.view.js';

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
    hasAvailablePlaces: event.hasAvailablePlaces,
    distanceMeters: event.distanceMeters
  };
}

export function toMyEventView({
  event,
  isOrganizer,
  participationStatus,
  participationStatusUpdatedAt
}: MyEventItem) {
  return {
    ...toPublicEventView(event),
    status: event.status,
    updatedAt: event.updatedAt,
    isOrganizer,
    isHiddenByAdmin: event.isHiddenByAdmin,
    cancellationReason: event.cancellationReason,
    participationStatus,
    participationStatusUpdatedAt
  };
}

export function toEventDetailView(result: Awaited<ReturnType<GetEventByIdUseCase['execute']>>) {
  if (result.kind === 'DRAFT') {
    return { ...toEventView(result.event), location: result.location };
  }

  const {
    event,
    tags,
    organizer,
    reviews,
    approvedParticipantCount,
    availablePlaces,
    participantAvatars,
    participationStatus,
    actions,
    location,
    onlineUrl
  } = result;
  return {
    ...toPublicEventView(event),
    status: event.status,
    cancellationReason: event.cancellationReason,
    hideExactAddress: event.hideExactAddress,
    tags,
    organizer,
    reviews: toReviewPageView(reviews),
    approvedParticipantCount,
    availablePlaces,
    participantAvatars,
    participationStatus,
    actions,
    location,
    onlineUrl
  };
}

export function toMapEventView(event: FeedEvent) {
  return {
    id: event.id,
    title: event.title,
    categoryId: event.categoryId,
    firstStartsAt: event.firstStartsAt,
    status: event.status,
    hasAvailablePlaces: event.hasAvailablePlaces,
    coordinates: event.mapCoordinates
  };
}
