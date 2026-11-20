import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetDateOfBirthUseCase } from '../../../../src/modules/onboarding/application/index.js';
import { AppError } from '../../../../src/common/index.js';
import {
    OnboardingAlreadyCompletedError,
    OnboardingStepImmutableError
} from '../../../../src/modules/onboarding/domain/index.js';
import {
    createMockStateRepository,
    createMockUserProvider,
    createMockUserOnboardingProvider,
    createMockAuditLogger,
    createMockUnitOfWork
} from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import { createMockOnboardingState } from '../../../fixtures/onboarding.fixture.js';

describe('SetDateOfBirthUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let audit: ReturnType<typeof createMockAuditLogger>;
    let unitOfWork: ReturnType<typeof createMockUnitOfWork>;
    let useCase: SetDateOfBirthUseCase;

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        audit = createMockAuditLogger();
        unitOfWork = createMockUnitOfWork();
        useCase = new SetDateOfBirthUseCase(
            unitOfWork,
            stateRepository,
            createMockUserProvider(),
            onboardingUsers,
            audit
        );
    });

    const validBirthDate = new Date('1995-05-15T00:00:00.000Z');

    it('sets date of birth and advances to PROFILE', async () => {
        const state = createMockOnboardingState();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            dateOfBirth: validBirthDate,
            currentStep: 'PROFILE',
            completedSteps: ['DATE_OF_BIRTH']
        });

        const result = await useCase.execute(
            { user: createMockAuthUser({ birthDate: null }), ip: '127.0.0.1' },
            validBirthDate
        );

        expect(result.currentStep).toBe('PROFILE');
        expect(result.completedSteps).toContain('DATE_OF_BIRTH');
        expect(unitOfWork.run).toHaveBeenCalledTimes(1);
        expect(onboardingUsers.applyDateOfBirth).toHaveBeenCalledWith(
            'user-1',
            validBirthDate,
            expect.anything()
        );
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ONBOARDING_STEP_DATE_OF_BIRTH' }),
            expect.anything()
        );
    });

    it('creates state if not exists (idempotent create)', async () => {
        const state = createMockOnboardingState();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(null);
        vi.mocked(stateRepository.create).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce(state);

        await useCase.execute({ user: createMockAuthUser(), ip: null }, validBirthDate);

        expect(stateRepository.create).toHaveBeenCalledWith('user-1', expect.anything());
    });

    it('throws 422 if age < 14', async () => {
        const tooYoung = new Date('2015-01-01T00:00:00.000Z');
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, tooYoung)
        ).rejects.toMatchObject({ statusCode: 422, message: 'Minimum registration age is 14' });
    });

    it('throws 409 if onboarding already completed', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser({ onboardingCompleted: true }), ip: null },
                validBirthDate
            )
        ).rejects.toThrow(OnboardingAlreadyCompletedError);
    });

    it('throws 409 if birthDate already set (immutable)', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser({ birthDate: validBirthDate }), ip: null },
                validBirthDate
            )
        ).rejects.toThrow(OnboardingStepImmutableError);
    });

    it('throws 422 if birthDate is invalid Date (NaN)', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, new Date('invalid'))
        ).rejects.toBeInstanceOf(AppError);
    });
});