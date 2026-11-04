import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import logger from '../common/logger.js';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  const message =
    err instanceof AppError && err.isOperational ? err.message : 'Internal server error';

  if (statusCode >= 500) logger.error({ err, statusCode }, 'Request error');
  else logger.warn({ statusCode, message: err.message }, 'Request warning');

  res.status(statusCode).json({
    status: 'error',
    message
  });
};
