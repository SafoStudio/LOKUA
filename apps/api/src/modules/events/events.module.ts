import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import { TypeOrmUnitOfWork } from '../../common/index.js';
import type { CategoryProvider, CityProvider } from '../dictionaries/index.js';
import type { LocationProvider } from '../geolocation/index.js';
import { ManageEventUseCase } from './application/use-cases/manage-event.use-case.js';
import { ManageParticipationUseCase } from './application/use-cases/manage-participation.use-case.js';
import { ListEventParticipationUseCase } from './application/use-cases/list-event-participation.use-case.js';
import { GetMyEventsUseCase } from './application/use-cases/get-my-events.use-case.js';
import { AdvanceEventLifecycleUseCase } from './application/use-cases/advance-event-lifecycle.use-case.js';
import { EventDiscussionUseCase } from './application/use-cases/event-discussion.use-case.js';
import { EventReviewsUseCase } from './application/use-cases/event-reviews.use-case.js';
import { startEventLifecycleWorker } from './infrastructure/event-lifecycle.worker.js';
import { EventLifecycleRepositoryAdapter } from './infrastructure/persistence/adapters/event-lifecycle.repository.adapter.js';
import { DiscussionCommentRepositoryAdapter } from './infrastructure/persistence/adapters/discussion-comment.repository.adapter.js';
import { EventReviewRepositoryAdapter } from './infrastructure/persistence/adapters/event-review.repository.adapter.js';
import type {
  AccessService,
  AuthUserProvider,
  UserBlockProvider,
  UserProfileProvider
} from '../users/index.js';
import {
  DiscussionCommentEntity,
  EventEntity,
  EventRepositoryAdapter,
  EventReviewEntity
} from './infrastructure/index.js';
import { CreateEventUseCase, GetEventsUseCase, GetEventByIdUseCase } from './application/index.js';
import { createEventsController } from './presentation/http/events.controller.js';
import { createDiscussionController } from './presentation/http/discussion.controller.js';
import { createEventReviewController } from './presentation/http/event-review.controller.js';
import { createEventsRouter } from './presentation/http/events.routes.js';
import { createOrganizerProfilesRouter } from './presentation/http/organizer-profiles.routes.js';

export interface CreateEventsModuleDependencies {
  dataSource: DataSource;
  access: AccessService;
  cities: CityProvider;
  profiles: UserProfileProvider;
  blocks: UserBlockProvider;
  authUsers: AuthUserProvider;
  categories: CategoryProvider;
  locations: LocationProvider;
  optionalAuth: RequestHandler;
  requireAuth: RequestHandler;
}

export function createEventsModule({
  dataSource,
  access,
  categories,
  locations,
  cities,
  profiles,
  blocks,
  authUsers,
  optionalAuth,
  requireAuth
}: CreateEventsModuleDependencies) {
  const eventRepository = new EventRepositoryAdapter(dataSource.getRepository(EventEntity));

  const unitOfWork = new TypeOrmUnitOfWork(dataSource);
  const clock = () => new Date();
  const reviews = new EventReviewsUseCase(
    eventRepository,
    new EventReviewRepositoryAdapter(dataSource.getRepository(EventReviewEntity)),
    unitOfWork,
    access,
    blocks,
    profiles,
    clock
  );
  const discussion = new EventDiscussionUseCase(
    eventRepository,
    new DiscussionCommentRepositoryAdapter(dataSource.getRepository(DiscussionCommentEntity)),
    unitOfWork,
    access,
    blocks,
    profiles,
    clock
  );
  const advanceEventLifecycle = new AdvanceEventLifecycleUseCase(
    new EventLifecycleRepositoryAdapter(),
    unitOfWork,
    clock
  );
  const manageParticipation = new ManageParticipationUseCase(
    eventRepository,
    unitOfWork,
    authUsers,
    access,
    blocks,
    clock
  );
  const manageEvent = new ManageEventUseCase(
    eventRepository,
    unitOfWork,
    access,
    categories,
    locations,
    clock
  );
  const createEvent = new CreateEventUseCase(manageEvent);
  const getEvents = new GetEventsUseCase(eventRepository, access, cities, profiles, blocks, clock);
  const getMyEvents = new GetMyEventsUseCase(eventRepository, access, blocks, clock);
  const getEventById = new GetEventByIdUseCase(
    eventRepository,
    access,
    blocks,
    profiles,
    locations,
    reviews,
    clock
  );

  const listParticipation = new ListEventParticipationUseCase(
    eventRepository,
    access,
    blocks,
    profiles,
    clock
  );
  const controller = createEventsController({
    listParticipation,
    manageParticipation,
    manageEvent,
    createEvent,
    getEvents,
    getMyEvents,
    getEventById
  });

  const reviewController = createEventReviewController(reviews);
  const router = createEventsRouter({
    requireAuth,
    optionalAuth,
    controller,
    discussion: createDiscussionController(discussion),
    reviews: reviewController
  });

  return {
    createEvent,
    getEvents,
    getEventById,
    startLifecycleWorker: () => startEventLifecycleWorker(() => advanceEventLifecycle.execute()),
    profilesRouter: createOrganizerProfilesRouter(optionalAuth, reviewController),
    router
  };
}

export type EventsModule = ReturnType<typeof createEventsModule>;
