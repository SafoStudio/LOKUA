import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { UserBlockService } from '../../application/services/user-block.service.js';

const params = z.object({ userId: z.uuid().transform((id) => id.toLowerCase()) });

export function createUserBlocksRouter(requireAuth: RequestHandler, blocks: UserBlockService) {
  const router = Router();
  router.use(requireAuth, (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', async (req, res) => {
    if (!req.user) throw new AppError('Потрібна авторизація', 401);
    res.json({ data: await blocks.list(req.user.id) });
  });
  router.put('/:userId', validate({ params }), async (req, res) => {
    if (!req.user) throw new AppError('Потрібна авторизація', 401);
    await blocks.block(req.user.id, req.params.userId as string);
    res.status(204).end();
  });
  router.delete('/:userId', validate({ params }), async (req, res) => {
    if (!req.user) throw new AppError('Потрібна авторизація', 401);
    await blocks.unblock(req.user.id, req.params.userId as string);
    res.status(204).end();
  });
  return router;
}
