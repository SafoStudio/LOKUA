import { logger } from './common/index.js';
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { AppDataSource } from './db/data-source.js';
import { createModules } from './bootstrap/modules.js';
import { createApp } from './app.js';

try {
  await AppDataSource.initialize();
  logger.info('Database connected');

  const modules = createModules(AppDataSource);
  const app = createApp({
    authRouter: modules.auth.router,
    onboardingRouter: modules.onboarding.router,
    geolocationRouter: modules.geolocation.router,
    adminUsersRouter: modules.moderation.adminUsersRouter,
    dictionariesRouter: modules.dictionaries.router,
    eventsRouter: modules.events.router,
    profilesRouter: modules.events.profilesRouter,
    notificationsRouter: modules.notifications.router,
    reportsRouter: modules.moderation.reportsRouter,
    imageMediaRouter: modules.storage.imageMediaRouter,
    profilePhotosRouter: modules.profilePhotosRouter,
    profileSettingsRouter: modules.profileSettingsRouter,
    userBlocksRouter: modules.userBlocksRouter,
    accountDeletionRouter: modules.accountDeletionRouter
  });

  const server = createServer(app).listen({ port: env.PORT, host: env.BIND_HOST }, () => {
    logger.info(`API running at http://localhost:${env.PORT}`);
    logger.info(`Docs available at http://localhost:${env.PORT}/docs`);
    if (process.connected) process.send?.({ type: 'ready' });
  });
  server.once('error', (err) => {
    logger.fatal({ err }, 'HTTP server failed to listen');
    process.exit(1);
  });
  const stopEventLifecycleWorker = modules.events.startLifecycleWorker();
  const stopNotificationDelivery = modules.notifications.startDeliveryWorker();
  const stopBlockExpiry = modules.moderation.startBlockExpiryWorker();
  const stopAccountDeletion = modules.startAccountDeletionWorker();
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const workersStopped = Promise.all([
      stopEventLifecycleWorker(),
      stopNotificationDelivery(),
      stopBlockExpiry(),
      stopAccountDeletion()
    ]);

    server.close(async (closeErr) => {
      if (closeErr) {
        logger.error({ err: closeErr }, 'HTTP server close failed');
      }

      try {
        await workersStopped;
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
  if (process.connected) process.on('disconnect', () => shutdown('IPC disconnect'));
} catch (err) {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
}
