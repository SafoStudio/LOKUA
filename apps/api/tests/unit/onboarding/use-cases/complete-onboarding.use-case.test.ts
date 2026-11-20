import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompleteOnboardingUseCase } from '../../../../src/modules/onboarding/application/index.js';
import {
    OnboardingAlreadyCompletedError,
    OnboardingIncompleteError
} from '../../../../src/modules/onboarding/domain/index.js';
import {
    createMockStateRepository,
    createMockUserProvider,
    createMockUserOnboardingProvider,
    createMockAuditLogger,
    createMockUnitOfWork
} from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import {
    createMockOnboardingState,
    withCompletedSteps
} from '../../../fixtures/onboarding.fixture.js';

describe('CompleteOnboardingUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let audit: ReturnType<typeof createMockAuditLogger>;
    let unitOfWork: ReturnType<typeof createMockUnitOfWork>;
    let useCase: CompleteOnboardingUseCase;

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        audit = createMockAuditLogger();
        unitOfWork = createMockUnitOfWork();
        useCase = new CompleteOnboardingUseCase(
            unitOfWork,
            stateRepository,
            createMockUserProvider(),
            onboardingUsers,
            audit
        );
    });

    it('completes onboarding with all mandatory steps', async () => {
        const state = createMockOnboardingState(
            withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS', 'OPTIONAL')
        );
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            currentStep: 'COMPLETED',
            completedAt: new Date()
        });

        const result = await useCase.execute({ user: createMockAuthUser(), ip: null });

        expect(result.currentStep).toBe('COMPLETED');
        expect(result.completedAt).not.toBeNull();
        expect(unitOfWork.run).toHaveBeenCalledTimes(1);
        expect(onboardingUsers.completeOnboarding).toHaveBeenCalledWith('user-1', expect.anything());
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ONBOARDING_COMPLETED' }),
            expect.anything()
        );
    });

    it('works without OPTIONAL step (it is optional)', async () => {
        const state = createMockOnboardingState(
            withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS')
        );
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            currentStep: 'COMPLETED',
            completedAt: new Date()
        });

        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null })
        ).resolves.toBeDefined();
    });

    it('throws 422 with missing steps list', async () => {
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(
            createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH', 'PROFILE'))
        );
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null })
        ).rejects.toThrow(OnboardingIncompleteError);
    });

    it('throws 409 if already completed', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser({ onboardingCompleted: true }), ip: null })
        ).rejects.toThrow(OnboardingAlreadyCompletedError);
    });

    it('throws 400 if state not found', async () => {
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(null);
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('propagates audit.log failure through the transaction', async () => {
        const state = createMockOnboardingState(
            withCompletedSteps('DATE_OF_BIRTH', 'PROFILE', 'CITY', 'INTERESTS')
        );
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce(state);
        vi.mocked(audit.log).mockRejectedValueOnce(new Error('audit failure'));

        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null })
        ).rejects.toThrow('audit failure');
    });
});