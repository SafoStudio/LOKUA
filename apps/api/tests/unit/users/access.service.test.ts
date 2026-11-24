import { describe, it, expect } from 'vitest';
import { AccessService } from '../../../src/modules/users/index.js';
import { createMockAuthUser } from '../../fixtures/users.fixture.js';

describe('AccessService', () => {
    const service = new AccessService();
    const NOW = new Date('2025-06-15T12:00:00.000Z');

    const userWithAge = (age: number, overrides = {}) =>
        createMockAuthUser({
            birthDate: new Date(`${NOW.getFullYear() - age}-01-01T00:00:00.000Z`),
            onboardingCompleted: true,
            ...overrides
        });

    describe('canCreateEvent', () => {
        it('true for active verified onboarded 16+', () => {
            expect(service.canCreateEvent(userWithAge(16), NOW)).toBe(true);
        });
        it('false for age 15', () => {
            expect(service.canCreateEvent(userWithAge(15), NOW)).toBe(false);
        });
        it('false if not onboarded', () => {
            expect(service.canCreateEvent(userWithAge(16, { onboardingCompleted: false }), NOW)).toBe(false);
        });
        it('false if email not verified', () => {
            expect(service.canCreateEvent(userWithAge(16, { emailVerified: false }), NOW)).toBe(false);
        });
        it('false if blocked', () => {
            expect(service.canCreateEvent(userWithAge(16, { status: 'BLOCKED_TEMPORARY' }), NOW)).toBe(false);
        });
        it('false if birthDate null', () => {
            expect(service.canCreateEvent(createMockAuthUser({ birthDate: null }), NOW)).toBe(false);
        });
    });

    describe('canJoinEvent', () => {
        it('NONE + active → true (14+)', () => {
            expect(service.canJoinEvent(userWithAge(14), 'ALL', NOW)).toBe(true);
        });
        it('SIXTEEN_PLUS + age 15 → false', () => {
            expect(service.canJoinEvent(userWithAge(15), 'SIXTEEN_PLUS', NOW)).toBe(false);
        });
        it('SIXTEEN_PLUS + age 16 → true', () => {
            expect(service.canJoinEvent(userWithAge(16), 'SIXTEEN_PLUS', NOW)).toBe(true);
        });
        it('EIGHTEEN_PLUS + age 17 → false', () => {
            expect(service.canJoinEvent(userWithAge(17), 'EIGHTEEN_PLUS', NOW)).toBe(false);
        });
        it('EIGHTEEN_PLUS + age 18 → true', () => {
            expect(service.canJoinEvent(userWithAge(18), 'EIGHTEEN_PLUS', NOW)).toBe(true);
        });
        it('false if not onboarded', () => {
            expect(service.canJoinEvent(userWithAge(20, { onboardingCompleted: false }), 'ALL', NOW)).toBe(false);
        });
    });

    describe('canViewEvent', () => {
        it('NONE + null user → true', () => {
            expect(service.canViewEvent(null, 'ALL', NOW)).toBe(true);
        });
        it('EIGHTEEN_PLUS + null user → false', () => {
            expect(service.canViewEvent(null, 'EIGHTEEN_PLUS', NOW)).toBe(false);
        });
        it('EIGHTEEN_PLUS + age 17 → false', () => {
            expect(service.canViewEvent(userWithAge(17), 'EIGHTEEN_PLUS', NOW)).toBe(false);
        });
        it('EIGHTEEN_PLUS + age 18 → true', () => {
            expect(service.canViewEvent(userWithAge(18), 'EIGHTEEN_PLUS', NOW)).toBe(true);
        });
    });

    describe('canCreateEventWithRestriction', () => {
        it('EIGHTEEN_PLUS + age 17 → false', () => {
            expect(service.canCreateEventWithRestriction(userWithAge(17), 'EIGHTEEN_PLUS', NOW)).toBe(false);
        });
        it('SIXTEEN_PLUS + age 17 → true', () => {
            expect(service.canCreateEventWithRestriction(userWithAge(17), 'SIXTEEN_PLUS', NOW)).toBe(true);
        });
        it('false if base check fails', () => {
            expect(
                service.canCreateEventWithRestriction(userWithAge(20, { onboardingCompleted: false }), 'ALL', NOW)
            ).toBe(false);
        });
    });

    describe('isBlocked', () => {
        it.each([
            ['ACTIVE', false],
            ['BLOCKED_TEMPORARY', true],
            ['BLOCKED_PERMANENT', true],
            ['PENDING_DELETION', true],
            ['DELETED', true]
        ] as const)('%s → %s', (status, expected) => {
            expect(service.isBlocked(createMockAuthUser({ status }))).toBe(expected);
        });
    });

    describe('canAccessAdmin', () => {
        it('USER → false for MODERATOR', () => {
            expect(service.canAccessAdmin(createMockAuthUser({ role: 'USER' }), 'MODERATOR')).toBe(false);
        });
        it('MODERATOR → true for MODERATOR', () => {
            expect(service.canAccessAdmin(createMockAuthUser({ role: 'MODERATOR' }), 'MODERATOR')).toBe(true);
        });
        it('MODERATOR → false for ADMIN', () => {
            expect(service.canAccessAdmin(createMockAuthUser({ role: 'MODERATOR' }), 'ADMIN')).toBe(false);
        });
        it('ADMIN → true for ADMIN', () => {
            expect(service.canAccessAdmin(createMockAuthUser({ role: 'ADMIN' }), 'ADMIN')).toBe(true);
        });
        it('blocked ADMIN → false', () => {
            expect(
                service.canAccessAdmin(createMockAuthUser({ role: 'ADMIN', status: 'BLOCKED_TEMPORARY' }), 'ADMIN')
            ).toBe(false);
        });
    });
});