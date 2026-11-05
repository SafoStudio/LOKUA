import app from './app.js';
import logger from './common/logger.js';
import { env } from './config/env.js';
import { AppDataSource } from './db/data-source.js';

try {
  await AppDataSource.initialize();
  logger.info('Database connected');

  app.listen(env.PORT, () => {
    logger.info(`API running at http://localhost:${env.PORT}`);
  });
} catch (err) {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
}
