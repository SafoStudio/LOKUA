import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetOptionalProfileUseCase } from '../../../../src/modules/onboarding/application/index.js';
import { OnboardingStepOutOfOrderError } from '../../../../src/modules/onboarding/domain/index.js';
import {
    createMockStateRepository,
    createMockUserOnboardingProvider,
    createMockAuditLogger,
    createMockUnitOfWork
} from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import {
    createMockOnboardingState,
    withCompletedSteps
} from '../../../fixtures/onboarding.fixture.js';

describe('SetOptionalProfileUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let unitOfWork: ReturnType<typeof createMockUnitOfWork>;
    let useCase: SetOptionalProfileUseCase;

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        unitOfWork = createMockUnitOfWork();
        useCase = new SetOptionalProfileUseCase(
            unitOfWork,
            stateRepository,
            onboardingUsers,
            createMockAuditLogger()
        );
    });

    const setupHappyPath = () => {
        const state = createMockOnboardingState(
            withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS')
        );
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            bio: 'test bio',
            currentStep: 'COMPLETED',
            completedSteps: ['DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS', 'OPTIONAL']
        });
    };

    it('sets bio + languages and advances to COMPLETED', async () => {
        setupHappyPath();
        const result = await useCase.execute(
            { user: createMockAuthUser(), ip: null },
            { bio: 'test bio', languages: ['uk', 'en'] }
        );
        expect(result.currentStep).toBe('COMPLETED');
        expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    });

    it('sets socialLinks', async () => {
        setupHappyPath();
        await useCase.execute(
            { user: createMockAuthUser(), ip: null },
            { socialLinks: { telegram: 'https://t.me/user' } }
        );
        expect(onboardingUsers.applyOptionalProfile).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({ socialLinks: { telegram: 'https://t.me/user' } }),
            expect.anything()
        );
    });

    it('throws 400 for empty body', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, {})
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 422 for bio > 300 chars', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { bio: 'a'.repeat(301) })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it.each(['not-a-url', 'https://', 'mailto:example@example.com'])('throws 400 for invalid social link URL %s', async (url) => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser(), ip: null },
                { socialLinks: { telegram: url } }
            )
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 409 if INTERESTS not completed', async () => {
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(
            createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY'))
        );
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { bio: 'test' })
        ).rejects.toThrow(OnboardingStepOutOfOrderError);
    });
});
