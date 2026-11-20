import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import type { CityProvider } from '../../../dictionaries/index.js';
import { AppError, assertString } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import {
  OnboardingAlreadyCompletedError,
  OnboardingStepOutOfOrderError
} from '../../domain/index.js';
import { ensureOnboardingState } from './ensure-onboarding-state.js';

export class SetCityUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly cities: CityProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(context: OnboardingContext, data: { cityId: unknown }): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    const cityId = assertString(data.cityId, 'cityId');
    const city = await this.cities.findById(cityId);
    if (!city) throw new AppError('City not found', 422);
    if (!city.isActive) throw new AppError('City is not active', 422);

    return this.unitOfWork.run(async (tx) => {
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, tx);

      if (!state.completedSteps.includes('PROFILE')) {
        throw new OnboardingStepOutOfOrderError('PROFILE', state.currentStep);
      }

      await this.onboardingUsers.applyCity(context.user.id, cityId, tx);

      const nextCompleted = state.completedSteps.includes('CITY')
        ? state.completedSteps
        : [...state.completedSteps, 'CITY' as const];

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          cityId,
          currentStep: 'INTERESTS',
          completedSteps: nextCompleted
        },
        tx
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_STEP_CITY',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: { cityId },
          ip: context.ip
        },
        tx
      );

      return updated;
    });
  }
}
