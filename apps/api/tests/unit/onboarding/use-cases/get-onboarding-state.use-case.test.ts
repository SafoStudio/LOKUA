import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetOnboardingStateUseCase } from '../../../../src/modules/onboarding/application/index.js';
import { createMockStateRepository } from '../../../helpers/mock-ports.js';
import { createMockAuthUser } from '../../../fixtures/users.fixture.js';
import { createMockOnboardingState } from '../../../fixtures/onboarding.fixture.js';

describe('GetOnboardingStateUseCase', () => {
    let stateRepository: ReturnType<typeof createMockStateRepository>;
    let useCase: GetOnboardingStateUseCase;

    beforeEach(() => {
        stateRepository = createMockStateRepository();
        useCase = new GetOnboardingStateUseCase(stateRepository);
    });

    it('returns existing state', async () => {
        const state = createMockOnboardingState();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(state);

        const result = await useCase.execute({ user: createMockAuthUser(), ip: null });

        expect(result).toEqual(state);
    });

    it('creates state if not exists', async () => {
        const state = createMockOnboardingState();
        vi.mocked(stateRepository.findByUserId).mockResolvedValueOnce(null);
        vi.mocked(stateRepository.create).mockResolvedValueOnce(state);

        const result = await useCase.execute({ user: createMockAuthUser(), ip: null });

        expect(result).toEqual(state);
        expect(stateRepository.create).toHaveBeenCalledWith('user-1', undefined);
    });
});