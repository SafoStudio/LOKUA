import type { AuthUser, User } from '../../../../src/modules/users/index.js';
import type { OnboardingState, OnboardingStep } from '../../../../src/modules/onboarding/domain/index.js';

export function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        role: 'USER',
        status: 'ACTIVE',
        onboardingCompleted: false,
        birthDate: null,
        ...overrides
    };
}

export function createUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
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
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        ...overrides
    };
}

export function createOnboardingState(overrides: Partial<OnboardingState> = {}): OnboardingState {
    return {
        id: 'state-123',
        userId: 'user-123',
        currentStep: 'DATE_OF_BIRTH',
        completedSteps: [],
        dateOfBirth: null,
        name: null,
        mainPhotoUrl: null,
        cityId: null,
        interestIds: null,
        bio: null,
        languages: null,
        socialLinks: null,
        completedAt: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        ...overrides
    };
}

export function withCompletedSteps(...steps: OnboardingStep[]): Partial<OnboardingState> {
    return {
        completedSteps: steps,
        currentStep: steps.length > 0 ? steps[steps.length - 1] : 'DATE_OF_BIRTH'
    };
}