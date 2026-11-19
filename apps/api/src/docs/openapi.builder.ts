import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiSpec } from './openapi.types.js';

function parseYamlFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[openapi] File not found: ${filePath}`);
  }

  const parsed: unknown = YAML.parse(fs.readFileSync(filePath, 'utf8'));

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[openapi] Invalid YAML object: ${filePath}`);
  }

  return parsed as Record<string, unknown>;
}

function collectYamlFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];

  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectYamlFiles(fullPath));
    } else if (entry.isFile() && /\.(yaml|yml)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function mergeYamlDirectory(
  dirPath: string,
  target: Record<string, unknown>,
  sourceLabel: string
): void {
  for (const file of collectYamlFiles(dirPath)) {
    const parsed = parseYamlFile(file);
    const relativeName = path.relative(dirPath, file).replace(/\\/g, '/');

    for (const [key, value] of Object.entries(parsed)) {
      if (Object.hasOwn(target, key)) {
        throw new Error(
          `[openapi] Duplicate key "${key}" while merging ` + `${sourceLabel}/${relativeName}`
        );
      }

      target[key] = value;
    }
  }
}

function mergeSchemaDirectory(dirPath: string, target: Record<string, unknown>): void {
  for (const file of collectYamlFiles(dirPath)) {
    const schemaName = path.basename(file).replace(/\.(yaml|yml)$/i, '');
    const schema = parseYamlFile(file);

    if (Object.hasOwn(target, schemaName)) {
      throw new Error(`[openapi] Duplicate schema "${schemaName}"`);
    }

    target[schemaName] = schema;
  }
}

function mergeSecuritySchemes(filePath: string, target: Record<string, unknown>): void {
  if (!fs.existsSync(filePath)) return;

  const schemes = parseYamlFile(filePath);

  for (const [key, value] of Object.entries(schemes)) {
    if (Object.hasOwn(target, key)) {
      throw new Error(`[openapi] Duplicate security scheme "${key}"`);
    }

    target[key] = value;
  }
}

export function buildDocument(docsDir: string): OpenApiSpec {
  const root = parseYamlFile(path.join(docsDir, 'openapi.yaml')) as unknown as OpenApiSpec;

  root.paths = root.paths ?? {};
  root.components = root.components ?? {
    schemas: {},
    securitySchemes: {}
  };

  root.components.schemas = root.components.schemas ?? {};
  root.components.securitySchemes = root.components.securitySchemes ?? {};

  mergeYamlDirectory(path.join(docsDir, 'paths'), root.paths, 'paths');

  mergeSchemaDirectory(path.join(docsDir, 'components', 'schemas'), root.components.schemas);

  mergeSecuritySchemes(
    path.join(docsDir, 'components', 'security', 'schemes.yaml'),
    root.components.securitySchemes
  );

  return root;
}
