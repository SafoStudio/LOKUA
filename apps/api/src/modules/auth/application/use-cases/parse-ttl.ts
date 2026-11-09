const TTL_PATTERN = /^(\d+)([smhd])$/;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

export function parseTtlToMs(ttl: string): number {
  const match = TTL_PATTERN.exec(ttl);

  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  return value * UNIT_MS[unit];
}
