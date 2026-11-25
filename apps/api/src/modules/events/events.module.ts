import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import { TypeOrmUnitOfWork } from '../../common/index.js';
import type { CategoryProvider, CityProvider } from '../dictionaries/index.js';
import type { LocationProvider } from '../geolocation/index.js';
import { ManageEventUseCase } from './application/use-cases/manage-event.use-case.js';
import type { AccessService, UserBlockProvider, UserProfileProvider } from '../users/index.js';
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
  optionalAuth,
  requireAuth
}: CreateEventsModuleDependencies) {
  const eventRepository = new EventRepositoryAdapter(dataSource.getRepository(EventEntity));

  const manageEvent = new ManageEventUseCase(
    eventRepository,
    new TypeOrmUnitOfWork(dataSource),
    access,
    categories,
    locations,
    () => new Date()
  );
  const createEvent = new CreateEventUseCase(manageEvent);
  const getEvents = new GetEventsUseCase(
    eventRepository,
    access,
    cities,
    profiles,
    blocks,
    () => new Date()
  );
  const getEventById = new GetEventByIdUseCase(eventRepository, access, manageEvent);

  const controller = createEventsController({
    manageEvent,
    createEvent,
    getEvents,
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
