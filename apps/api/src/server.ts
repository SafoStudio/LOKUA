import { logger } from './common/index.js';
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

  const server = app.listen(env.PORT, () => {
    logger.info(`API running at http://localhost:${env.PORT}`);
    logger.info(`Docs available at http://localhost:${env.PORT}/docs`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');

    server.close(async (closeErr) => {
      if (closeErr) {
        logger.error({ err: closeErr }, 'HTTP server close failed');
      }

      try {
        await AppDataSource.destroy();
        logger.info('Database connection closed');
        process.exit(closeErr ? 1 : 0);
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Database close failed');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (err) {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
}
