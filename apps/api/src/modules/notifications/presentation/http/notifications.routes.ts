import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { NotificationStore } from '../../infrastructure/notification.store.js';

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional()
});
const preferenceSchema = z.strictObject({ emailEnabled: z.boolean() });
const notificationParams = z.object({ id: z.uuid() });

export function createNotificationsRouter(
  requireAuth: RequestHandler,
  store: Pick<NotificationStore, 'list' | 'getPreferences' | 'setPreferences' | 'markRead'>
) {
  const router = Router();
  router.use(requireAuth, (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  router.get('/', validate({ query: pageSchema }), async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { limit, cursor } = req.query as unknown as z.infer<typeof pageSchema>;
    const rows = await store.list(req.user.id, limit + 1, cursor);
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null;
    res.json({
      data: page.map(({ id, type, targetType, targetId, title, message, isRead, createdAt }) => ({
        id,
        type,
        targetType,
        targetId,
        title,
        message,
        isRead,
        createdAt
      })),
      pagination: { nextCursor, hasMore: nextCursor !== null }
    });
  });

  router.get('/preferences', async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const preferences = await store.getPreferences(req.user.id);
    if (!preferences) throw new AppError('User not found', 404);
    res.json({ data: preferences });
  });

  router.patch('/preferences', validate({ body: preferenceSchema }), async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { emailEnabled } = req.body as z.infer<typeof preferenceSchema>;
    await store.setPreferences(req.user.id, emailEnabled);
    res.json({ data: { emailEnabled } });
  });

  router.patch('/:id/read', validate({ params: notificationParams }), async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { id } = req.params as { id: string };
    if (!(await store.markRead(req.user.id, id))) throw new AppError('Notification not found', 404);
    res.status(204).end();
  });

  return router;
}
