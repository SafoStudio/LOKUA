import type { DataSource } from 'typeorm';
import type { AccessService } from '../users/index.js';

export interface CreateEventsModuleDependencies {
  dataSource: DataSource;
  access: AccessService;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO: remove when logic is added
export function createEventsModule({ dataSource, access }: CreateEventsModuleDependencies) {
  return {};
}

export type EventsModule = ReturnType<typeof createEventsModule>;
