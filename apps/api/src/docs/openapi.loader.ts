import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiSpec } from './openapi.types.js';
import { buildDocument } from './openapi.builder.js';

let cachedDoc: OpenApiSpec | null = null;
let cachedYaml: string | null = null;
let cachedJson: string | null = null;

const DOCS_DIR_CANDIDATES = [
  'docs/openapi',
  'apps/api/docs/openapi',
  '../../docs/openapi',
  '../../../docs/openapi'
];

function findDocsDir(): string {
  const bases = new Set<string>();

  if (typeof import.meta.dirname === 'string') {
    bases.add(import.meta.dirname);
  }

  bases.add(process.cwd());

  const tried: string[] = [];

  for (const base of bases) {
    for (const relative of DOCS_DIR_CANDIDATES) {
      const candidate = path.resolve(base, relative);

      tried.push(candidate);

      if (fs.existsSync(path.join(candidate, 'openapi.yaml'))) {
        return candidate;
      }
    }
  }

  throw new Error(`[openapi] OpenAPI document not found. Tried:\n  ${tried.join('\n  ')}`);
}

export function loadOpenApiDocument(): OpenApiSpec {
  if (!cachedDoc) cachedDoc = buildDocument(findDocsDir());
  return cachedDoc;
}

export function getOpenApiYaml(): string {
  if (!cachedYaml) cachedYaml = YAML.stringify(loadOpenApiDocument());
  return cachedYaml;
}

export function getOpenApiJson(): string {
  if (!cachedJson) cachedJson = JSON.stringify(loadOpenApiDocument(), null, 2);
  return cachedJson;
}
