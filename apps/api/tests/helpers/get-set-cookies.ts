import type { Response } from 'supertest';

export function getSetCookies(res: Response): string[] {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}