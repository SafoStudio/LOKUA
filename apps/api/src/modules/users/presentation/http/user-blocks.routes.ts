import type { RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middlewares/index.js';
import type { UserBlockService } from '../../application/services/user-block.service.js';
import { createPrivateUsersRouter, requireCurrentUserId } from './private-users-router.js';

const params = z.object({ userId: z.uuid().transform((id) => id.toLowerCase()) });

export function createUserBlocksRouter(requireAuth: RequestHandler, blocks: UserBlockService) {
  const router = createPrivateUsersRouter(requireAuth);
  router.get('/', async (req, res) => {
    res.json({ data: await blocks.list(requireCurrentUserId(req)) });
  });
  router.put('/:userId', validate({ params }), async (req, res) => {
    await blocks.block(requireCurrentUserId(req), req.params.userId as string);
    res.status(204).end();
  });
  router.delete('/:userId', validate({ params }), async (req, res) => {
    await blocks.unblock(requireCurrentUserId(req), req.params.userId as string);
    res.status(204).end();
  });
  return router;
}
