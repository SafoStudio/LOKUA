import { randomUUID } from 'node:crypto';

export interface BuildStorageKeyInput {
  entity: string;
  entityId: string;
  kind: string;
  extension: string;
}

const SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function assertSegment(name: string, value: string): void {
  if (!SEGMENT_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${name} segment for storage key: "${value}" (expected [a-zA-Z0-9][a-zA-Z0-9_-]*)`
    );
  }
}

export function buildStorageKey(input: BuildStorageKeyInput): string {
  assertSegment('entity', input.entity);
  assertSegment('entityId', input.entityId);
  assertSegment('kind', input.kind);
  assertSegment('extension', input.extension);

  return `${input.entity}/${input.entityId}/${input.kind}/${randomUUID()}.${input.extension}`;
}
