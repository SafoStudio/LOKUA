import type {AuthUser, User, UserProfile} from '../../src/modules/users/index.js';

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

export function createMockUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true,
        birthDate: null,
        role: 'USER',
        status: 'ACTIVE',
        cityId: null,
        bio: null,
        languages: null,
        socialLinks: null,
        onboardingCompleted: false,
        termsAcceptedAt: null,
        blockedUntil: null,
        deletionRequestedAt: null,
        notificationSettings: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides
    };
}

export function createMockUserProfile(
    overrides: Partial<UserProfile> = {}
): UserProfile {
    return {
        id: 'user-1',
        name: 'User',
        email: 'user@example.com',
        avatarUrl: null,
        cityId: null,
        interestIds: [],
        onboardingCompleted: false,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides
    };
}