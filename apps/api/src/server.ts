import app from './app.js';
import logger from './common/logger.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  logger.info(`API running at http://localhost:${env.PORT}`);
});
