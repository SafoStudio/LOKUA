import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { UserProvider } from '../users/index.js';
import { EventEntity, EventRepositoryAdapter } from './infrastructure/index.js';
import { CreateEventUseCase, GetEventsUseCase, GetEventByIdUseCase } from './application/index.js';
import { createEventsController } from './presentation/http/events.controller.js';
import { createEventsRouter } from './presentation/http/events.routes.js';

export interface CreateEventsModuleDependencies {
  dataSource: DataSource;
  users: UserProvider;
  requireAuth: RequestHandler;
}

export function createEventsModule({
  dataSource,
  users,
  requireAuth
}: CreateEventsModuleDependencies) {
  const eventRepository = new EventRepositoryAdapter(dataSource.getRepository(EventEntity));

  const createEvent = new CreateEventUseCase(eventRepository, users);
  const getEvents = new GetEventsUseCase(eventRepository);
  const getEventById = new GetEventByIdUseCase(eventRepository);

  const controller = createEventsController({
    createEvent,
    getEvents,
    getEventById
  });

  const router = createEventsRouter({
    requireAuth,
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
