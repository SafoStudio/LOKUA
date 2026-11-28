import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { UserProfileProvider } from '../../application/index.js';
import type { ProfileSettingsService } from '../../application/services/profile-settings.service.js';
import { createPrivateUsersRouter, requireCurrentUserId } from './private-users-router.js';

const settingsBody = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    cityId: z
      .uuid()
      .transform((id) => id.toLowerCase())
      .optional(),
    interestIds: z
      .array(z.uuid().transform((id) => id.toLowerCase()))
      .min(3)
      .max(20)
      .optional(),
    bio: z.string().trim().max(300).nullable().optional(),
    languages: z.array(z.string().trim().min(1).max(10)).nullable().optional(),
    socialLinks: z
      .record(z.string(), z.url({ protocol: /^https?$/ }))
      .nullable()
      .optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'Потрібно вказати хоча б одне поле');

export function createProfileSettingsRouter(
  requireAuth: RequestHandler,
  profiles: UserProfileProvider,
  settings: ProfileSettingsService
) {
  const router = createPrivateUsersRouter(requireAuth);
  router.get('/', async (req, res) => {
    const profile = await profiles.findByUserId(requireCurrentUserId(req));
    if (!profile) throw new AppError('Профіль не знайдено', 404);
    res.json({
      data: {
        name: profile.name,
        cityId: profile.cityId,
        interestIds: profile.interestIds,
        birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? null,
        photoUrls: profile.photoUrls ?? [],
        bio: profile.bio ?? null,
        languages: profile.languages ?? null,
        socialLinks: profile.socialLinks ?? null
      }
    });
  });
  router.patch('/', validate({ body: settingsBody }), async (req, res) => {
    await settings.update(requireCurrentUserId(req), req.body);
    res.status(204).end();
  });
  return router;
}
