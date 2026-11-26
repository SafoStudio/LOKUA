import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../../common/index.js';
import { validate } from '../../../../middlewares/index.js';
import type { ModerationUseCase } from '../../application/use-cases/moderation.use-case.js';

const contentType = z.enum(['EVENT', 'COMMENT', 'REVIEW']);
const reportStatus = z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']);
const idParams = z.object({ id: z.uuid() });
const contentParams = idParams.extend({ type: contentType });
const reasonText = z.string().trim().min(1).max(500);
const reportInput = z
  .strictObject({
    objectType: z.enum(['EVENT', 'COMMENT', 'REVIEW', 'PROFILE']),
    objectId: z.uuid(),
    reason: z.enum([
      'SPAM',
      'ABUSE',
      'UNSAFE_OR_ILLEGAL_EVENT',
      'FAKE_PROFILE',
      'INAPPROPRIATE_CONTENT',
      'OTHER'
    ]),
    text: reasonText.optional()
  })
  .refine((input) => input.reason !== 'OTHER' || input.text !== undefined, {
    path: ['text'],
    message: 'A description is required for the OTHER reason'
  });
const reportPage = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
  status: reportStatus.optional()
});
const transition = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('IN_PROGRESS') }),
  z.strictObject({ status: z.enum(['RESOLVED', 'REJECTED']), notes: reasonText.optional() })
]);
const visibility = z.strictObject({ isHiddenByAdmin: z.boolean(), reason: reasonText });
const account = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('BLOCKED_TEMPORARY'),
    blockedUntil: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    reason: reasonText
  }),
  z.strictObject({ status: z.enum(['ACTIVE', 'BLOCKED_PERMANENT']), reason: reasonText })
]);

function actor(req: Request) {
  if (!req.user) throw new AppError('Authentication required', 401);
  return req.user;
}

export function createReportsRouter(requireAuth: RequestHandler, moderation: ModerationUseCase) {
  const router = Router();
  router.post('/', requireAuth, validate({ body: reportInput }), async (req, res) => {
    const report = await moderation.submit(actor(req), req.body as z.infer<typeof reportInput>);
    res
      .status(201)
      .json({ data: { id: report.id, status: report.status, createdAt: report.createdAt } });
  });
  return router;
}

export function createAdminModerationRouter(moderation: ModerationUseCase) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/reports', validate({ query: reportPage }), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof reportPage>;
    const { items, nextCursor } = await moderation.list(query.limit, query.status, query.cursor);
    res.json({ data: items, pagination: { nextCursor, hasMore: nextCursor !== null } });
  });
  router.get('/reports/:id', validate({ params: idParams }), async (req, res) => {
    const { id } = req.params as z.infer<typeof idParams>;
    const result = await moderation.inspect(actor(req), id, req.ip ?? null);
    res.json({ data: result });
  });
  router.patch(
    '/reports/:id',
    validate({ params: idParams, body: transition }),
    async (req, res) => {
      const { id } = req.params as z.infer<typeof idParams>;
      const input = req.body as z.infer<typeof transition>;
      const report = await moderation.transition(
        actor(req),
        id,
        input.status,
        'notes' in input ? (input.notes ?? null) : null,
        req.ip ?? null
      );
      res.json({ data: report });
    }
  );
  router.patch(
    '/content/:type/:id/visibility',
    validate({ params: contentParams, body: visibility }),
    async (req, res) => {
      const { type, id } = req.params as z.infer<typeof contentParams>;
      const input = req.body as z.infer<typeof visibility>;
      const result = await moderation.visibility(
        actor(req),
        type,
        id,
        input.isHiddenByAdmin,
        input.reason,
        req.ip ?? null
      );
      res.json({ data: result });
    }
  );
  router.patch(
    '/users/:id/status',
    validate({ params: idParams, body: account }),
    async (req, res) => {
      const { id } = req.params as z.infer<typeof idParams>;
      const input = req.body as z.infer<typeof account>;
      const result = await moderation.account(
        actor(req),
        id,
        input.status,
        'blockedUntil' in input ? input.blockedUntil : null,
        input.reason,
        req.ip ?? null
      );
      res.json({ data: result });
    }
  );
  return router;
}
