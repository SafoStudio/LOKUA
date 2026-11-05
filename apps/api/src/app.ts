import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import logger from './common/logger.js';
import { env } from './config/env.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';

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
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'lokua-api',
    timestamp: new Date().toISOString()
  });
});

app.use(notFound);
app.use(errorHandler);
export default app;
