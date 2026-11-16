import type { DataSource } from 'typeorm';

export interface CreateNotificationsModuleDependencies {
  dataSource: DataSource;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO: remove when logic is added
export function createNotificationsModule({ dataSource }: CreateNotificationsModuleDependencies) {
  return {};
}

export type NotificationsModule = ReturnType<typeof createNotificationsModule>;
