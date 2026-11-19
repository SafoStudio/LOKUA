import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiSpec } from './openapi.types.js';

function parseYamlFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = YAML.parse(fs.readFileSync(filePath, 'utf8'));
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function mergeYamlDirectory(
  dirPath: string,
  target: Record<string, unknown>,
  sourceLabel: string,
  filter: (file: string) => boolean = () => true
): void {
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath).filter(filter).sort();

  for (const file of files) {
    const parsed = parseYamlFile(path.join(dirPath, file));
    if (!parsed) continue;

    for (const [key, value] of Object.entries(parsed)) {
      if (key in target) {
        throw new Error(
          `[openapi] Duplicate key "${key}" while merging ${sourceLabel}/${file}: ` +
            `already defined earlier. Rename the key or remove the duplicate.`
        );
      }
      target[key] = value;
    }
  }
}

export function buildDocument(docsDir: string): OpenApiSpec {
  const root = YAML.parse(
    fs.readFileSync(path.join(docsDir, 'openapi.yaml'), 'utf8')
  ) as OpenApiSpec;

  root.paths = root.paths ?? {};
  root.components = root.components ?? { schemas: {}, securitySchemes: {} };
  root.components.schemas = root.components.schemas ?? {};
  root.components.securitySchemes = root.components.securitySchemes ?? {};

  const isYaml = (file: string) => file.endsWith('.yaml') || file.endsWith('.yml');

  mergeYamlDirectory(path.join(docsDir, 'paths'), root.paths, 'paths', isYaml);
  mergeYamlDirectory(
    path.join(docsDir, 'components', 'schemas'),
    root.components.schemas,
    'components/schemas',
    isYaml
  );

  const security = parseYamlFile(path.join(docsDir, 'components', 'security', 'schemes.yaml'));
  if (security) {
    for (const [key, value] of Object.entries(security)) {
      if (key in root.components.securitySchemes) {
        throw new Error(`[openapi] Duplicate security scheme "${key}"`);
      }
      root.components.securitySchemes[key] = value;
    }
  }

  return root;
}
