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
  onboardingRouter?: express.Router;
  geolocationRouter?: express.Router;
  adminUsersRouter?: express.Router;
  dictionariesRouter?: express.Router;
  eventsRouter: express.Router;
  profilesRouter?: express.Router;
  notificationsRouter?: express.Router;
  reportsRouter?: express.Router;
  imageMediaRouter?: express.Router;
  profilePhotosRouter?: express.Router;
  profileSettingsRouter?: express.Router;
  userBlocksRouter?: express.Router;
  accountDeletionRouter?: express.Router;
}

const API_PREFIX = '/api/v1';

export function createApp({
  authRouter,
  onboardingRouter,
  geolocationRouter,
  adminUsersRouter,
  dictionariesRouter,
  eventsRouter,
  profilesRouter,
  notificationsRouter,
  reportsRouter,
  imageMediaRouter,
  profilePhotosRouter,
  profileSettingsRouter,
  userBlocksRouter,
  accountDeletionRouter
}: AppDependencies) {
  const app = express();

  app.use(
    pinoHttp({
      logger,

      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
        censor: '[REDACTED]'
      },

      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: (req.url ?? '').split('?')[0],
          remoteAddress: req.remoteAddress
        }),

        res: (res) => ({
          statusCode: res.statusCode
        })
      },

      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';

        return env.LOG_HTTP ? 'info' : 'silent';
      },

      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url?.split('?')[0]} ${res.statusCode}`,

      customErrorMessage: (req, res) => `${req.method} ${req.url?.split('?')[0]} ${res.statusCode}`
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

  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'lokua-api',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/openapi.json', (_req, res) => res.redirect('/docs/openapi.json'));
  app.get('/openapi.yaml', (_req, res) => res.redirect('/docs/openapi.yaml'));
  app.use('/docs', createDocsRouter());

  app.use(`${API_PREFIX}/auth`, authRouter);
  if (accountDeletionRouter) app.use(`${API_PREFIX}/auth`, accountDeletionRouter);

  if (onboardingRouter) {
    app.use(`${API_PREFIX}/onboarding`, onboardingRouter);
  }

  if (geolocationRouter) {
    app.use(`${API_PREFIX}/geo`, geolocationRouter);
  }

  if (adminUsersRouter) {
    app.use(`${API_PREFIX}/admin`, adminUsersRouter);
  }
  if (dictionariesRouter) app.use(`${API_PREFIX}/dictionaries`, dictionariesRouter);

  if (eventsRouter) {
    app.use(`${API_PREFIX}/events`, eventsRouter);
  }
  if (profilesRouter) {
    app.use(`${API_PREFIX}/users`, profilesRouter);
  }
  if (notificationsRouter) {
    app.use(`${API_PREFIX}/notifications`, notificationsRouter);
  }
  if (reportsRouter) app.use(`${API_PREFIX}/reports`, reportsRouter);
  if (imageMediaRouter) app.use(`${API_PREFIX}/media`, imageMediaRouter);
  if (profilePhotosRouter) app.use(`${API_PREFIX}/users/me/photos`, profilePhotosRouter);
  if (profileSettingsRouter) app.use(`${API_PREFIX}/users/me/profile`, profileSettingsRouter);
  if (userBlocksRouter) app.use(`${API_PREFIX}/users/me/blocks`, userBlocksRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
