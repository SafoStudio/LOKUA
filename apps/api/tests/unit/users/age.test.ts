import { describe, it, expect } from 'vitest';
import { calculateAge } from '../../../src/modules/users/index.js';

describe('calculateAge', () => {
    const NOW = new Date('2025-06-15T12:00:00.000Z');

    it('returns null for null birthDate', () => {
        expect(calculateAge(null, NOW)).toBeNull();
    });

    it('returns exact age on birthday', () => {
        expect(calculateAge(new Date('1995-06-15T00:00:00.000Z'), NOW)).toBe(30);
    });

    it('returns age minus one before birthday this year', () => {
        expect(calculateAge(new Date('1995-06-16T00:00:00.000Z'), NOW)).toBe(29);
    });

    it('returns exact age after birthday this year', () => {
        expect(calculateAge(new Date('1995-06-14T00:00:00.000Z'), NOW)).toBe(30);
    });

    it('returns 14 for exactly 14 years old', () => {
        expect(calculateAge(new Date('2011-06-15T00:00:00.000Z'), NOW)).toBe(14);
    });

    it('returns 13 for one day before 14th birthday', () => {
        expect(calculateAge(new Date('2011-06-16T00:00:00.000Z'), NOW)).toBe(13);
    });

    it('handles Feb 29 birth date', () => {
        const birthDate = new Date('2000-02-29T00:00:00.000Z');
        expect(calculateAge(birthDate, new Date('2025-02-28T12:00:00.000Z'))).toBe(24);
        expect(calculateAge(birthDate, new Date('2025-03-01T12:00:00.000Z'))).toBe(25);
    });

    it('accepts string birthDate (Postgres date column returns string)', () => {
        expect(calculateAge('1995-06-15' as unknown as Date, NOW)).toBe(30);
    });
});