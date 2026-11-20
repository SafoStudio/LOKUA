import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import { OnboardingAlreadyCompletedError, OnboardingIncompleteError } from '../../domain/index.js';

export class CompleteOnboardingUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(context: OnboardingContext): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    return this.unitOfWork.run(async (tx) => {
      const state = await this.stateRepository.findByUserId(context.user.id, tx);
      if (!state) {
        throw new AppError('Onboarding not started', 400);
      }

      if (state.completedAt !== null) {
        throw new OnboardingAlreadyCompletedError();
      }

      const required: Array<'DATE_OF_BIRTH' | 'PROFILE' | 'CITY' | 'INTERESTS'> = [
        'DATE_OF_BIRTH',
        'PROFILE',
        'CITY',
        'INTERESTS'
      ];
      const missing = required.filter((step) => !state.completedSteps.includes(step));
      if (missing.length > 0) {
        throw new OnboardingIncompleteError(missing);
      }

      const completedAt = new Date();

      await this.onboardingUsers.completeOnboarding(context.user.id, tx);

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          currentStep: 'COMPLETED',
          completedAt
        },
        tx
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_COMPLETED',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: { completedAt: completedAt.toISOString() },
          ip: context.ip
        },
        tx
      );

      return updated;
    });
  }
}
