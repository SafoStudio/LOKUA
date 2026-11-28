import type { UserOnboardingProvider } from '../../../users/index.js';
import type { InterestProvider } from '../../../dictionaries/index.js';
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
import { advanceStep } from '../../domain/advance-step.js';

export class SetInterestsUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly interests: InterestProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(
    context: OnboardingContext,
    data: { interestIds: unknown }
  ): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    if (!Array.isArray(data.interestIds)) {
      throw new AppError('interestIds must be an array', 400);
    }

    const interestIds = data.interestIds.map((id) => assertString(id, 'interestId'));
    const uniqueIds = [...new Set(interestIds)];

    if (uniqueIds.length < 3) {
      throw new AppError('At least 3 interests required', 422);
    }

    if (uniqueIds.length > 20) {
      throw new AppError('Maximum 20 interests allowed', 422);
    }

    const found = await this.interests.findByIds(uniqueIds);
    if (found.length !== uniqueIds.length) {
      const foundSet = new Set(found.map((i) => i.id));
      const missing = uniqueIds.filter((id) => !foundSet.has(id));
      throw new AppError(`Interests not found or inactive: ${missing.join(', ')}`, 422);
    }

    return this.unitOfWork.run(async (tx) => {
      await this.onboardingUsers.lockActiveAccount(context.user.id, tx);
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, tx);

      if (!state.completedSteps.includes('CITY')) {
        throw new OnboardingStepOutOfOrderError('CITY', state.currentStep);
      }

      await this.onboardingUsers.applyInterests(context.user.id, uniqueIds, tx);

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          interestIds: uniqueIds,
          ...advanceStep(state, 'INTERESTS')
        },
        tx
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_STEP_INTERESTS',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: { interestIds: uniqueIds },
          ip: context.ip
        },
        tx
      );

      return updated;
    });
  }
}
