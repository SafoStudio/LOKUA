import type { DataSource } from 'typeorm';
import type { RequestHandler } from 'express';
import type { AccessService } from '../users/index.js';
import { EventEntity, EventRepositoryAdapter } from './infrastructure/index.js';
import { CreateEventUseCase, GetEventsUseCase, GetEventByIdUseCase } from './application/index.js';
import { createEventsController } from './presentation/http/events.controller.js';
import { createEventsRouter } from './presentation/http/events.routes.js';

export interface CreateEventsModuleDependencies {
  dataSource: DataSource;
  access: AccessService;
  optionalAuth: RequestHandler;
  requireAuth: RequestHandler;
}

export function createEventsModule({
  dataSource,
  access,
  optionalAuth,
  requireAuth
}: CreateEventsModuleDependencies) {
  const eventRepository = new EventRepositoryAdapter(dataSource.getRepository(EventEntity));

  const createEvent = new CreateEventUseCase(eventRepository, access);
  const getEvents = new GetEventsUseCase(eventRepository, access);
  const getEventById = new GetEventByIdUseCase(eventRepository, access);

  const controller = createEventsController({
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
