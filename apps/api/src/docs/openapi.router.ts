import { Router } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { getOpenApiYaml, getOpenApiJson } from './openapi.loader.js';

export function createDocsRouter(): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });

  router.get('/openapi.yaml', (_req, res) => {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.send(getOpenApiYaml());
  });

  router.get('/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getOpenApiJson());
  });

  router.use(
    '/',
    apiReference({
      url: '/docs/openapi.json',
      pageTitle: 'LOKUA API Documentation',
      theme: 'purple'
    })
  );

  return router;
}
