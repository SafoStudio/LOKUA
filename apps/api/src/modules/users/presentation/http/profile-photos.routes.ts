import type { RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middlewares/index.js';
import type { ProfilePhotosService } from '../../application/services/profile-photos.service.js';
import { createPrivateUsersRouter, requireCurrentUserId } from './private-users-router.js';

const profilePhotosSchema = z.strictObject({
  photoUrls: z
    .array(z.url().max(2048))
    .min(1)
    .max(3)
    .refine((urls) => new Set(urls).size === urls.length, 'Photo URLs must be unique')
});

export function createProfilePhotosRouter(
  requireAuth: RequestHandler,
  photos: ProfilePhotosService
) {
  const router = createPrivateUsersRouter(requireAuth);
  router.get('/', async (req, res) => {
    res.json({ data: { photoUrls: await photos.list(requireCurrentUserId(req)) } });
  });
  router.put('/', validate({ body: profilePhotosSchema }), async (req, res) => {
    const { photoUrls } = req.body as z.infer<typeof profilePhotosSchema>;
    await photos.replace(requireCurrentUserId(req), photoUrls);
    res.json({ data: { photoUrls } });
  });
  return router;
}
