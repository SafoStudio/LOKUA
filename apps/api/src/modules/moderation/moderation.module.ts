import type { DataSource } from 'typeorm';

export interface CreateModerationModuleDependencies {
  dataSource: DataSource;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO: remove when logic is added
export function createModerationModule({ dataSource }: CreateModerationModuleDependencies) {
  return {};
}

export type ModerationModule = ReturnType<typeof createModerationModule>;
