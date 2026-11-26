import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import { TypeOrmUnitOfWork } from '../../common/index.js';
import type { CategoryProvider, CityProvider } from '../dictionaries/index.js';
import type { LocationProvider } from '../geolocation/index.js';
import { ManageEventUseCase } from './application/use-cases/manage-event.use-case.js';
import { ManageParticipationUseCase } from './application/use-cases/manage-participation.use-case.js';
import { ListEventParticipationUseCase } from './application/use-cases/list-event-participation.use-case.js';
import { GetMyEventsUseCase } from './application/use-cases/get-my-events.use-case.js';
import type {
  AccessService,
  AuthUserProvider,
  UserBlockProvider,
  UserProfileProvider
} from '../users/index.js';
import { EventEntity, EventRepositoryAdapter } from './infrastructure/index.js';
import { CreateEventUseCase, GetEventsUseCase, GetEventByIdUseCase } from './application/index.js';
import { createEventsController } from './presentation/http/events.controller.js';
import { createEventsRouter } from './presentation/http/events.routes.js';

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

  const router = createEventsRouter({
    requireAuth,
    optionalAuth,
    controller
  });

  return {
    createEvent,
    getEvents,
    getEventById,
    router
  };
}

export type EventsModule = ReturnType<typeof createEventsModule>;
