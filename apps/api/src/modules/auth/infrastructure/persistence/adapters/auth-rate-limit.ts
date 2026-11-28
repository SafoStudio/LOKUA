import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { Request, RequestHandler } from 'express';

export function createSharedAuthRateLimit(dataSource: DataSource) {
  let nextCleanup = 0;

  return (
      scope: string,
      limit: number,
      windowMs: number,
      key: (request: Request) => string = (request) => request.ip ?? 'unknown'
    ): RequestHandler =>
    async (req, res, next) => {
      const now = Date.now();
      if (now >= nextCleanup) {
        nextCleanup = now + 60_000;
        await dataSource.query('DELETE FROM auth_rate_limits WHERE expires_at <= now()');
      }
      const digest = createHash('sha256').update(key(req)).digest('hex');
      const [window] = await dataSource.query<{ count: number; retry_after: number }[]>(
        `INSERT INTO auth_rate_limits (key, count, expires_at)
         VALUES ($1, 1, now() + $2 * interval '1 millisecond')
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN auth_rate_limits.expires_at <= now() THEN 1
                        ELSE LEAST(auth_rate_limits.count + 1, $3 + 1) END,
           expires_at = CASE WHEN auth_rate_limits.expires_at <= now() THEN excluded.expires_at
                             ELSE auth_rate_limits.expires_at END
         RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - now())))::int AS retry_after`,
        [`${scope}:${digest}`, windowMs, limit]
      );
      if (window.count <= limit) return next();
      res.set('Retry-After', String(window.retry_after)).set('Cache-Control', 'no-store');
      res.status(429).json({ status: 'error', message: 'Забагато запитів. Спробуйте пізніше.' });
    };
}
