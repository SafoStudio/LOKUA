import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import { createRequestRateLimit } from '../../../src/middlewares/request-rate-limit.js';

it('allows new requests after the request window ends', async () => {
  let now = 0;
  const app = express();
  app.get(
    '/',
    createRequestRateLimit({ limit: 1, windowMs: 4000 }, () => now),
    (_req, res) => { res.sendStatus(204); }
  );
  const api = request(app);

  await api.get('/').expect(204);
  now = 1001;
  await api.get('/').expect(429).expect('Retry-After', '3');
  now = 4000;
  await api.get('/').expect(204);
  expect((await api.get('/')).headers['retry-after']).toBe('4');
});
