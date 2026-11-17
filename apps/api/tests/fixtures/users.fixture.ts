import type { AuthUser } from '../../src/modules/users/index.js';

export function createMockAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true,
        role: 'USER',
        status: 'ACTIVE',
        onboardingCompleted: false,
        birthDate: null,
        ...overrides
    };
}