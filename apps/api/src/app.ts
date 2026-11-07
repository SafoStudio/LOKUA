import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './common/index.js';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middlewares/index.js';
import { createDocsRouter } from './docs/index.js';

interface AppDependencies {
  authRouter: express.Router;
}

export function createApp({ authRouter }: AppDependencies) {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]'
      }
    })
  );

  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'lokua-api',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/docs', createDocsRouter());

  app.use('/api/v1/auth', authRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
