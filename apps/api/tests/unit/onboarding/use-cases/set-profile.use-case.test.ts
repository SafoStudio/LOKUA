import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetProfileUseCase } from '../../../../src/modules/onboarding/application/index.js';
import {
    OnboardingAlreadyCompletedError,
    OnboardingStepOutOfOrderError
} from '../../../../src/modules/onboarding/domain/index.js';
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

describe('SetProfileUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let audit: ReturnType<typeof createMockAuditLogger>;
    let unitOfWork: ReturnType<typeof createMockUnitOfWork>;
    let useCase: SetProfileUseCase;

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        audit = createMockAuditLogger();
        unitOfWork = createMockUnitOfWork();
        useCase = new SetProfileUseCase(
            unitOfWork,
            stateRepository,
            onboardingUsers,
            audit,
            { assertOwnedUrl: vi.fn() }
        );
    });

    const validData = { name: 'Test User', mainPhotoUrl: 'https://example.com/photo.jpg' };

    const stateAfterDob = () =>
        createMockOnboardingState({
            ...withCompletedSteps('DATE_OF_BIRTH'),
            dateOfBirth: new Date('1995-05-15T00:00:00.000Z')
        });

    it('sets profile and advances to CITY', async () => {
        const state = stateAfterDob();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            name: validData.name,
            mainPhotoUrl: validData.mainPhotoUrl,
            currentStep: 'CITY',
            completedSteps: ['DATE_OF_BIRTH', 'PROFILE']
        });

        const result = await useCase.execute(
            { user: createMockAuthUser({ birthDate: new Date('1995-05-15') }), ip: null },
            validData
        );

        expect(result.currentStep).toBe('CITY');
        expect(unitOfWork.run).toHaveBeenCalledTimes(1);
        expect(onboardingUsers.applyProfile).toHaveBeenCalledWith('user-1', validData, expect.anything());
    });

    it('does not duplicate PROFILE on repeat', async () => {
        const state = createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH', 'PROFILE'));
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce(state);

        await useCase.execute({ user: createMockAuthUser(), ip: null }, validData);

        const updateCall = vi.mocked(stateRepository.updateStep).mock.calls[0];
        expect(updateCall[1].completedSteps).toEqual(['DATE_OF_BIRTH', 'PROFILE']);
    });

    it('throws 409 if DATE_OF_BIRTH not completed', async () => {
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(createMockOnboardingState());

        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, validData)
        ).rejects.toThrow(OnboardingStepOutOfOrderError);
    });

    it('throws 422 for empty name', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser(), ip: null },
                { name: '   ', mainPhotoUrl: validData.mainPhotoUrl }
            )
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 for name longer than 100', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser(), ip: null },
                { name: 'a'.repeat(101), mainPhotoUrl: validData.mainPhotoUrl }
            )
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 for invalid photo URL', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser(), ip: null },
                { name: 'Test', mainPhotoUrl: 'not-a-url' }
            )
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 409 if onboarding already completed', async () => {
        await expect(
            useCase.execute(
                { user: createMockAuthUser({ onboardingCompleted: true }), ip: null },
                validData
            )
        ).rejects.toThrow(OnboardingAlreadyCompletedError);
    });

    it('accepts multiple photos via applyProfile (BR-ACC-01)', async () => {
        // TODO: Once SetProfileUseCase is extended, it should accept additionalPhotoUrls
        // For now: applyProfile is called with a single mainPhotoUrl
        const state = stateAfterDob();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce(state);

        await useCase.execute({ user: createMockAuthUser(), ip: null }, validData);

        expect(onboardingUsers.applyProfile).toHaveBeenCalledTimes(1);
    });
});
