import { describe, it, expect } from 'vitest';
import { parseTtlToMs } from '../../../../src/modules/auth/application/use-cases/parse-ttl.js';

describe('parseTtlToMs', () => {
    it('parses seconds', () => {
        expect(parseTtlToMs('60s')).toBe(60_000);
    });

    it('parses minutes', () => {
        expect(parseTtlToMs('15m')).toBe(15 * 60_000);
    });

    it('parses hours', () => {
        expect(parseTtlToMs('2h')).toBe(2 * 60 * 60_000);
    });

    it('parses days', () => {
        expect(parseTtlToMs('7d')).toBe(7 * 24 * 60 * 60_000);
    });

    it('throws on invalid format', () => {
        expect(() => parseTtlToMs('abc')).toThrow('Invalid TTL format');
        expect(() => parseTtlToMs('7')).toThrow('Invalid TTL format');
        expect(() => parseTtlToMs('7x')).toThrow('Invalid TTL format');
        expect(() => parseTtlToMs('')).toThrow('Invalid TTL format');
    });
});