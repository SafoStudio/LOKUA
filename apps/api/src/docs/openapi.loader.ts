import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiSpec } from './openapi.types.js';
import { buildDocument } from './openapi.builder.js';

let cachedDoc: OpenApiSpec | null = null;
let cachedYaml: string | null = null;
let cachedJson: string | null = null;

const DOCS_DIR_CANDIDATES = [
  ['docs/openapi'],
  ['apps/api/docs/openapi'],
  ['../../docs/openapi'],
  ['../../../docs/openapi']
];

function findDocsDir(): string {
  for (const [relative] of DOCS_DIR_CANDIDATES) {
    const candidate = path.resolve(import.meta.dirname ?? process.cwd(), relative);
    if (fs.existsSync(candidate)) return candidate;
    const fromCwd = path.resolve(process.cwd(), relative);
    if (fs.existsSync(fromCwd)) return fromCwd;
  }
  throw new Error('OpenAPI docs directory not found');
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
