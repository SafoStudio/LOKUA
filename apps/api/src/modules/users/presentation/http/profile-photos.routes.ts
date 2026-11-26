import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { ImageOwnership } from '../../../storage/index.js';
import type { UserPhotoProvider } from '../../application/ports/user-photo.provider.js';

const profilePhotosSchema = z.strictObject({
  photoUrls: z
    .array(z.url().max(2048))
    .min(1)
    .max(3)
    .refine((urls) => new Set(urls).size === urls.length, 'Photo URLs must be unique')
});

export function createProfilePhotosRouter(
  requireAuth: RequestHandler,
  photos: UserPhotoProvider,
  images: ImageOwnership
) {
  const router = Router();
  router.use(requireAuth, (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    res.json({ data: { photoUrls: await photos.list(req.user.id) } });
  });
  router.put('/', validate({ body: profilePhotosSchema }), async (req, res) => {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { photoUrls } = req.body as z.infer<typeof profilePhotosSchema>;
    const existing = new Set(await photos.list(req.user.id));
    for (const url of photoUrls) {
      if (!existing.has(url)) images.assertOwnedUrl(url, req.user.id, 'PROFILE');
    }
    await photos.replace(req.user.id, photoUrls);
    res.json({ data: { photoUrls } });
  });
  return router;
}
