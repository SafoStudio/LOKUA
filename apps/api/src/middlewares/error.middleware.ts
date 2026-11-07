import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, logger } from '../common/index.js';

export const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));

    logger.warn({ details }, 'Validation error');

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details
    });
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    logger.warn({ err }, 'Malformed JSON request');

    return res.status(400).json({
      status: 'error',
      message: 'Malformed JSON payload'
    });
  }

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
