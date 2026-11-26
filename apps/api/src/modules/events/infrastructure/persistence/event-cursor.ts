import type { MyEventsQuery } from '../../application/ports/my-events.repository.js';

export interface EventCursor {
  firstStartsAt: string | null;
  id: string;
  source?: 'CITY' | 'ONLINE' | 'MAP';
  distanceMeters?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCursorDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value) ||
    value.startsWith('0000-')
  ) {
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

function decodeCursor(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid event cursor');
  }

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new Error('Invalid event cursor');
  }
}

export function decodeEventCursor(value: string): EventCursor {
  const parsed = decodeCursor(value);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    typeof parsed.id !== 'string' ||
    !UUID_REGEX.test(parsed.id) ||
    ('source' in parsed &&
      parsed.source !== 'CITY' &&
      parsed.source !== 'ONLINE' &&
      parsed.source !== 'MAP') ||
    ('distanceMeters' in parsed &&
      (typeof parsed.distanceMeters !== 'number' ||
        !Number.isFinite(parsed.distanceMeters) ||
        parsed.distanceMeters < 0)) ||
    !('firstStartsAt' in parsed) ||
    !(parsed.firstStartsAt === null || isCursorDate(parsed.firstStartsAt))
  ) {
    throw new Error('Invalid event cursor');
  }

  return {
    id: parsed.id,
    firstStartsAt: parsed.firstStartsAt,
    source:
      'source' in parsed && (parsed.source === 'ONLINE' || parsed.source === 'MAP')
        ? parsed.source
        : 'CITY',
    distanceMeters:
      'distanceMeters' in parsed && typeof parsed.distanceMeters === 'number'
        ? parsed.distanceMeters
        : undefined
  };
}

interface MyEventsCursor {
  tab: MyEventsQuery['tab'];
  sortAt: string;
  id: string;
}

export function encodeMyEventsCursor(cursor: MyEventsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeMyEventsCursor(value: string, tab: MyEventsQuery['tab']): MyEventsCursor {
  const parsed = decodeCursor(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('tab' in parsed) ||
    parsed.tab !== tab ||
    !('sortAt' in parsed) ||
    !isCursorDate(parsed.sortAt) ||
    !('id' in parsed) ||
    typeof parsed.id !== 'string' ||
    !UUID_REGEX.test(parsed.id)
  ) {
    throw new Error('Invalid event cursor');
  }

  return { tab, sortAt: parsed.sortAt, id: parsed.id };
}
