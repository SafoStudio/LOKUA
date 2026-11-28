import type { Request, RequestHandler } from 'express';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key?: (request: Request) => string;
}

const maxKeys = 10_000;

export function createRequestRateLimit(
  {
    limit,
    windowMs,
    key = (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown'
  }: RateLimitOptions,
  now = Date.now
): RequestHandler {
  const windows = new Map<string, { count: number; endsAt: number }>();
  let nextSweep = 0;

  return (req, res, next) => {
    const time = now();
    if (time >= nextSweep) {
      for (const [id, window] of windows) {
        if (window.endsAt <= time) windows.delete(id);
      }
      nextSweep = time + Math.min(windowMs, 60_000);
    }

    const id = key(req);
    let window = windows.get(id);
    if (!window || window.endsAt <= time) {
      if (!window && windows.size >= maxKeys) {
        reject(Math.ceil((nextSweep - time) / 1000));
        return;
      }
      window = { count: 0, endsAt: time + windowMs };
      windows.set(id, window);
    }

    if (window.count >= limit) {
      reject(Math.ceil((window.endsAt - time) / 1000));
      return;
    }
    window.count++;
    next();

    function reject(seconds: number) {
      res.set('Retry-After', String(seconds)).set('Cache-Control', 'no-store').status(429).json({
        status: 'error',
        message: 'Забагато запитів. Спробуйте пізніше.'
      });
    }
  };
}
