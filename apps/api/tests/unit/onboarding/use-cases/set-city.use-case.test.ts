import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetCityUseCase } from '../../../../src/modules/onboarding/application/index.js';
import { AppError } from '../../../../src/common/index.js';
import { OnboardingStepOutOfOrderError } from '../../../../src/modules/onboarding/domain/index.js';
import {
    createMockStateRepository,
    createMockUserProvider,
    createMockUserOnboardingProvider,
    createMockAuditLogger,
    createMockCityProvider,
    createMockDataSource
} from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import {
    createMockOnboardingState,
    withCompletedSteps
} from '../../../fixtures/onboarding.fixture.js';

describe('SetCityUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let onboardingUsers: ReturnType<typeof createMockUserOnboardingProvider>;
    let cities: ReturnType<typeof createMockCityProvider>;
    let useCase: SetCityUseCase;

    const cityId = 'city-123';
    const validCity = {
        id: cityId,
        name: 'Київ',
        countryCode: 'UA',
        slug: 'kyiv',
        latitude: 50.45,
        longitude: 30.52,
        bbox: null,
        timezone: 'Europe/Kyiv',
        isActive: true
    };

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        onboardingUsers = createMockUserOnboardingProvider();
        cities = createMockCityProvider();
        useCase = new SetCityUseCase(
            createMockDataSource(),
            stateRepository,
            createMockUserProvider(),
            onboardingUsers,
            cities,
            createMockAuditLogger()
        );
    });

    it('sets city and advances to INTERESTS', async () => {
        vi.mocked(cities.findById).mockResolvedValueOnce(validCity);
        const state = createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH', 'PROFILE'));
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);
        vi.mocked(stateRepository.updateStep).mockResolvedValueOnce({
            ...state,
            cityId,
            currentStep: 'INTERESTS',
            completedSteps: ['DATE_OF_BIRTH', 'PROFILE', 'CITY']
        });

        const result = await useCase.execute(
            { user: createMockAuthUser(), ip: null },
            { cityId }
        );

        expect(result.currentStep).toBe('INTERESTS');
        expect(onboardingUsers.applyCity).toHaveBeenCalledWith('user-1', cityId, expect.anything());
    });

    it('throws 422 if city not found', async () => {
        vi.mocked(cities.findById).mockResolvedValueOnce(null);
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { cityId })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 422 if city inactive', async () => {
        vi.mocked(cities.findById).mockResolvedValueOnce({ ...validCity, isActive: false });
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { cityId })
        ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws 409 if PROFILE not completed', async () => {
        vi.mocked(cities.findById).mockResolvedValueOnce(validCity);
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(
            createMockOnboardingState(withCompletedSteps('DATE_OF_BIRTH'))
        );

        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { cityId })
        ).rejects.toThrow(OnboardingStepOutOfOrderError);
    });

    it('throws 422 for invalid cityId format', async () => {
        await expect(
            useCase.execute({ user: createMockAuthUser(), ip: null }, { cityId: '' })
        ).rejects.toBeInstanceOf(AppError);
    });
});