import type {
    OnboardingState,
    OnboardingStep
} from '../../src/modules/onboarding/domain/index.js';

export function createMockOnboardingState(
    overrides: Partial<OnboardingState> = {}
): OnboardingState {
    return {
        id: 'state-1',
        userId: 'user-1',
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
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides
    };
}

export function withCompletedSteps(
    ...steps: OnboardingStep[]
): Pick<OnboardingState, 'completedSteps' | 'currentStep'> {
    return {
        completedSteps: steps,
        currentStep: steps.length > 0 ? steps[steps.length - 1] : 'DATE_OF_BIRTH'
    };
}