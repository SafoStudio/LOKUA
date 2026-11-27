import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middlewares/index.js';
import type {
  Category,
  CategoryProvider,
  Interest,
  InterestProvider
} from '../../application/index.js';
import type { CategoryInput, InterestInput } from '../../application/admin-dictionary.js';

const params = z.object({ id: z.uuid() });
const interestBody = z.strictObject({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional()
});
const categoryBody = interestBody.extend({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  icon: z.string().trim().min(1).max(100).nullable().optional(),
  orderNum: z.number().int().min(0).max(2_147_483_647).optional()
});
const categoryPatch = categoryBody.partial().refine((body) => Object.keys(body).length > 0);
const interestPatch = interestBody.partial().refine((body) => Object.keys(body).length > 0);

interface AdminDictionary<Item, Input> {
  list(): Promise<Item[]>;
  create(input: Input): Promise<Item>;
  update(id: string, input: Partial<Input>): Promise<Item>;
}

export function createPublicDictionariesRouter(
  categories: CategoryProvider,
  interests: InterestProvider
) {
  const router = Router();
  router.get('/categories', async (_req, res) => {
    res.json({ data: await categories.listActive() });
  });
  router.get('/interests', async (_req, res) => {
    res.json({ data: await interests.listActive() });
  });
  return router;
}

export function createAdminDictionariesRouter(
  categories: AdminDictionary<Category, CategoryInput>,
  interests: AdminDictionary<Interest, InterestInput>
) {
  const router = Router();
  router.use('/categories', createAdminDictionaryRouter(categories, categoryBody, categoryPatch));
  router.use('/interests', createAdminDictionaryRouter(interests, interestBody, interestPatch));
  return router;
}

function createAdminDictionaryRouter<Item, Input>(
  dictionary: AdminDictionary<Item, Input>,
  createBody: z.ZodType<Input>,
  patchBody: z.ZodType<Partial<Input>>
) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', async (_req, res) => {
    res.json({ data: await dictionary.list() });
  });
  router.post('/', validate({ body: createBody }), async (req, res) => {
    res.status(201).json({ data: await dictionary.create(req.body as Input) });
  });
  router.patch('/:id', validate({ params, body: patchBody }), async (req, res) => {
    res.json({
      data: await dictionary.update(req.params.id as string, req.body as Partial<Input>)
    });
  });
  return router;
}
