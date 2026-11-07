import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { env } from '../../src/config/env.js';

describe('API Infrastructure, Security & Error Handling', () => {
  it('GET /health returns 200 with service status', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('lokua-api');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 404 AppError with route name when endpoint does not exist', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/api/v1/auth/non-existent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Route /api/v1/auth/non-existent not found'
    });
  });

  it('returns 400 when client sends malformed JSON body', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": "invalid json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Malformed JSON payload'
    });
  });

  it('includes Helmet security headers in responses', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('supports CORS with CLIENT_URL origin and credentials', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', env.CLIENT_URL)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('masks unexpected non-operational errors as 500 "Internal server error"', async () => {
    const { app, mocks } = createTestApp();

    vi.mocked(mocks.login.execute).mockRejectedValueOnce(
      new Error('Catastrophic unexpected bug in system')
    );

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'Password123'
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Internal server error'
    });
  });
});
