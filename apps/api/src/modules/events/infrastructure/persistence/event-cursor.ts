export interface EventCursor {
  firstStartsAt: string | null;
  id: string;
  source?: 'CITY' | 'ONLINE';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCursorDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value)) {
    return false;
  }
  const timestamp = new Date(value);
  return (
    Number.isFinite(timestamp.getTime()) &&
    timestamp.toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

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
    ('source' in parsed && parsed.source !== 'CITY' && parsed.source !== 'ONLINE') ||
    !('firstStartsAt' in parsed) ||
    !(parsed.firstStartsAt === null || isCursorDate(parsed.firstStartsAt))
  ) {
    throw new Error('Invalid event cursor');
  }

  return {
    id: parsed.id,
    firstStartsAt: parsed.firstStartsAt,
    source: 'source' in parsed && parsed.source === 'ONLINE' ? 'ONLINE' : 'CITY'
  };
}
