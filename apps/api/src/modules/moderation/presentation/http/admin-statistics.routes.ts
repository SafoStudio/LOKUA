import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middlewares/index.js';
import type { GetAdminStatisticsUseCase } from '../../application/use-cases/get-admin-statistics.use-case.js';

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const statisticsQuery = z.object({ from: instant, to: instant });

export function createAdminStatisticsRouter(statistics: GetAdminStatisticsUseCase) {
  const router = Router();
  router.get('/statistics', validate({ query: statisticsQuery }), async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof statisticsQuery>;
    const counts = await statistics.execute(from, to);
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: { from, to, ...counts } });
  });
  return router;
}
