import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { toSecurityContext } from '../../../../src/modules/auth/presentation/http/security-context.js';

describe('toSecurityContext', () => {
    it('extracts ip and user-agent from request', () => {
        const req = {
            ip: '203.0.113.1',
            headers: { 'user-agent': 'Mozilla/5.0' }
        } as unknown as Request;

        expect(toSecurityContext(req)).toEqual({
            ip: '203.0.113.1',
            userAgent: 'Mozilla/5.0'
        });
    });

    it('returns null ip when req.ip is undefined', () => {
        const req = {
            ip: undefined,
            headers: { 'user-agent': 'Mozilla/5.0' }
        } as unknown as Request;

        expect(toSecurityContext(req)).toEqual({
            ip: null,
            userAgent: 'Mozilla/5.0'
        });
    });

    it('returns null userAgent when header is missing', () => {
        const req = {
            ip: '127.0.0.1',
            headers: {}
        } as unknown as Request;

        expect(toSecurityContext(req)).toEqual({
            ip: '127.0.0.1',
            userAgent: null
        });
    });

    it('handles both missing', () => {
        const req = {
            ip: undefined,
            headers: {}
        } as unknown as Request;

        expect(toSecurityContext(req)).toEqual({
            ip: null,
            userAgent: null
        });
    });
});