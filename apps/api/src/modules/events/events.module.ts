import type { DataSource } from 'typeorm';

export interface CreateEventsModuleDependencies {
  dataSource: DataSource;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO: remove when logic is added
export function createEventsModule({ dataSource }: CreateEventsModuleDependencies) {
  return {};
}

export type EventsModule = ReturnType<typeof createEventsModule>;
