import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetInterestsUseCase } from '../../../../src/modules/onboarding/application/index.js';
import { OnboardingStepOutOfOrderError } from '../../../../src/modules/onboarding/domain/index.js';
import {
    createMockStateRepository,
    createMockUserOnboardingProvider,
    createMockAuditLogger,
    createMockInterestProvider,
    createMockUnitOfWork
} from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import {
    createMockOnboardingState,
    withCompletedSteps
} from '../../../fixtures/onboarding.fixture.js';

describe('SetInterestsUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let interests: ReturnType<typeof createMockInterestProvider>;
    let unitOfWork: ReturnType<typeof createMockUnitOfWork>;
    let useCase: SetInterestsUseCase;

    const ids = ['i1', 'i2', 'i3'];

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        interests = createMockInterestProvider();
        unitOfWork = createMockUnitOfWork();
        useCase = new SetInterestsUseCase(
            unitOfWork,
            stateRepository,
            onboardingUsers,
            interests,
            createMockAuditLogger()
        );
    });

    const setupHappyPath = () => {
        vi.mocked(interests.findActiveByIds).mockResolvedValueOnce([
            { id: 'i1', name: 'Біг', isActive: true },
            { id: 'i2', name: 'Настолки', isActive: true },
            { id: 'i3', name: 'Кава', isActive: true }
        ]);
        const state = createMockOnboardingState(
            withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY')
        );
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            interestIds: ids,
            currentStep: 'OPTIONAL',
            completedSteps: ['DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS']
        });
    };

    it('sets interests and advances to OPTIONAL', async () => {
        setupHappyPath();
        const result = await useCase.execute(
            { user: createMockAuthUser(), ip: null },
            { interestIds: ids }
        );
        expect(result.currentStep).toBe('OPTIONAL');
        expect(unitOfWork.run).toHaveBeenCalledTimes(1);
        expect(onboardingUsers.applyInterests).toHaveBeenCalledWith('user-1', ids, expect.anything());
    });

    it('deduplicates interest IDs', async () => {
        setupHappyPath();
        await useCase.execute(
            { user: createMockAuthUser(), ip: null },
            { interestIds: ['i1', 'i1', 'i2', 'i3'] }
        );
        expect(onboardingUsers.applyInterests).toHaveBeenCalledWith('user-1', ids, expect.anything());
    });

    it('throws 422 for fewer than 3 interests', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { interestIds: ['i1', 'i2'] })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 for more than 20 interests', async () => {
        const tooMany = Array.from({ length: 21 }, (_, i) => `i${i}`);
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { interestIds: tooMany })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 if some interests not found', async () => {
        vi.mocked(interests.findActiveByIds).mockResolvedValueOnce([
            { id: 'i1', name: 'Біг', isActive: true }
        ]);
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { interestIds: ids })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 409 if CITY not completed', async () => {
        vi.mocked(interests.findActiveByIds).mockResolvedValueOnce([
            { id: 'i1', name: 'Біг', isActive: true },
            { id: 'i2', name: 'Настолки', isActive: true },
            { id: 'i3', name: 'Кава', isActive: true }
        ]);
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(
            createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH', 'PROFILE'))
        );
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { interestIds: ids })
        ).rejects.toThrow(OnboardingStepOutOfOrderError);
    });

    it('throws 400 if interestIds not an array', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser(), ip: null },
                { interestIds: 'not-array' }
            )
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
