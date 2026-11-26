import express, { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import { imageContentTypes } from '../../application/image-media.service.js';
import type {
  ImageContentType,
  ImageMediaService,
  ImageScope
} from '../../application/image-media.service.js';

const uploadQuery = z.object({ scope: z.enum(['PROFILE', 'EVENT']) });

export function createImageMediaRouter(
  requireAuth: RequestHandler,
  images: ImageMediaService,
  limit: number
) {
  const router = Router();
  const readBody = express.raw({ type: () => true, limit, inflate: false });
  router.post(
    '/images',
    requireAuth,
    validate({ query: uploadQuery }),
    (req, res, next) => {
      if (!imageContentTypes.some((type) => req.is(type))) {
        return next(new AppError('Unsupported image media type', 415));
      }
      readBody(req, res, (error?: { status?: number }) => {
        if (!error) return next();
        const status = error.status === 413 || error.status === 415 ? error.status : 400;
        next(new AppError('Image request body could not be read', status));
      });
    },
    async (req, res) => {
      if (!req.user) throw new AppError('Authentication required', 401);
      if (!Buffer.isBuffer(req.body)) throw new AppError('Image body is required', 400);
      const declared = imageContentTypes.find((type) => req.is(type)) as ImageContentType;
      const { scope } = req.query as unknown as { scope: ImageScope };
      res.status(201).json({ data: await images.upload(req.user.id, scope, req.body, declared) });
    }
  );
  router.get('/images/:token', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.redirect(302, await images.download(req.params.token));
  });
  return router;
}
