export interface EventCursor {
  firstStartsAt: string | null;
  id: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeEventCursor(cursor: EventCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeEventCursor(value: string): EventCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid event cursor');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid event cursor');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    typeof parsed.id !== 'string' ||
    !UUID_REGEX.test(parsed.id) ||
    !('firstStartsAt' in parsed) ||
    !(
      parsed.firstStartsAt === null ||
      (typeof parsed.firstStartsAt === 'string' && !Number.isNaN(Date.parse(parsed.firstStartsAt)))
    )
  ) {
    throw new Error('Invalid event cursor');
  }

  return {
    id: parsed.id,
    firstStartsAt: parsed.firstStartsAt
  };
}
