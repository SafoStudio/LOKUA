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
  filter: (file: string) => boolean = () => true
): void {
  if (!fs.existsSync(dirPath)) return;
  for (const file of fs.readdirSync(dirPath).filter(filter)) {
    const parsed = parseYamlFile(path.join(dirPath, file));
    if (parsed) Object.assign(target, parsed);
  }
}

export function buildDocument(docsDir: string): OpenApiSpec {
  const root = YAML.parse(
    fs.readFileSync(path.join(docsDir, 'openapi.yaml'), 'utf8')
  ) as OpenApiSpec;

  root.paths = {};
  root.components = { schemas: {}, securitySchemes: {} };

  const isYaml = (file: string) => file.endsWith('.yaml') || file.endsWith('.yml');

  mergeYamlDirectory(path.join(docsDir, 'paths'), root.paths, isYaml);
  mergeYamlDirectory(path.join(docsDir, 'components', 'schemas'), root.components.schemas, isYaml);

  const security = parseYamlFile(path.join(docsDir, 'components', 'security', 'schemes.yaml'));
  if (security) Object.assign(root.components.securitySchemes, security);

  return root;
}
