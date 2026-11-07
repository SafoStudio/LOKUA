import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';
import { loadOpenApiDocument } from '../../src/docs/index.js';

describe('Docs & Scalar API Reference', () => {
  it('loads OpenAPI 3.1 document with all 13 auth endpoints and component schemas', () => {
    const doc = loadOpenApiDocument();

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('LOKUA API');

    // Verify all 13 auth endpoints are present
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/api/v1/auth/register');
    expect(paths).toContain('/api/v1/auth/login');
    expect(paths).toContain('/api/v1/auth/refresh');
    expect(paths).toContain('/api/v1/auth/logout');
    expect(paths).toContain('/api/v1/auth/me');
    expect(paths).toContain('/api/v1/auth/google');
    expect(paths).toContain('/api/v1/auth/google/callback');
    expect(paths).toContain('/api/v1/auth/passkey/signup/options');
    expect(paths).toContain('/api/v1/auth/passkey/signup/verify');
    expect(paths).toContain('/api/v1/auth/passkey/registration/options');
    expect(paths).toContain('/api/v1/auth/passkey/registration/verify');
    expect(paths).toContain('/api/v1/auth/passkey/login/options');
    expect(paths).toContain('/api/v1/auth/passkey/login/verify');
    expect(paths.length).toBeGreaterThanOrEqual(13);

    // Verify schemas
    const schemas = Object.keys(doc.components.schemas);
    expect(schemas).toContain('User');
    expect(schemas).toContain('RegisterRequest');
    expect(schemas).toContain('LoginRequest');
    expect(schemas).toContain('PasskeyVerifyRequest');
    expect(schemas).toContain('ErrorResponse');
    expect(schemas).toContain('ValidationErrorResponse');

    // Verify security schemes
    expect(doc.components.securitySchemes).toHaveProperty('CookieAuth');
    expect(doc.components.securitySchemes).toHaveProperty('BearerAuth');
    expect(doc.components.securitySchemes).toHaveProperty('RefreshCookieAuth');
  });

  it('GET /docs renders Scalar API Reference HTML and relaxes CSP', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Scalar API Reference');
    expect(res.text).toContain('@scalar/api-reference');

    // CSP should be removed on docs so browser can load Scalar client script
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('GET /docs/openapi.yaml returns raw YAML specification', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/docs/openapi.yaml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/yaml');
    expect(res.text).toContain('openapi: 3.1.0');
    expect(res.text).toContain('/api/v1/auth/register');
  });

  it('GET /docs/openapi.json returns raw JSON specification', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info.title).toBe('LOKUA API');
    expect(res.body.paths).toHaveProperty('/api/v1/auth/register');
  });
});
