import logger from './common/logger.js';
import { env } from './config/env.js';
import { AppDataSource } from './db/data-source.js';
import { createModules } from './bootstrap/modules.js';
import { createApp } from './app.js';

try {
  await AppDataSource.initialize();
  logger.info('Database connected');

  const modules = createModules(AppDataSource);
  const app = createApp({
    authRouter: modules.auth.router
  });

  app.listen(env.PORT, () => {
    logger.info(`API running at http://localhost:${env.PORT}`);
  });
} catch (err) {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
}
