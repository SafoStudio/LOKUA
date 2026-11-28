import type { UserOnboardingProvider } from '../../../users/index.js';
import { calculateAge } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import {
  OnboardingAlreadyCompletedError,
  OnboardingStepImmutableError
} from '../../domain/index.js';
import { ensureOnboardingState } from './ensure-onboarding-state.js';
import { advanceStep } from '../../domain/advance-step.js';

export class SetDateOfBirthUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(context: OnboardingContext, birthDate: Date): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    const age = calculateAge(birthDate);
    if (age === null || age < 14) {
      throw new AppError('Minimum registration age is 14', 422);
    }

    if (context.user.birthDate !== null) {
      throw new OnboardingStepImmutableError('DATE_OF_BIRTH');
    }

    return this.unitOfWork.run(async (tx) => {
      await this.onboardingUsers.lockActiveAccount(context.user.id, tx);
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, tx);
      if (state.dateOfBirth || state.completedSteps.includes('DATE_OF_BIRTH')) {
        throw new OnboardingStepImmutableError('DATE_OF_BIRTH');
      }

      await this.onboardingUsers.applyDateOfBirth(context.user.id, birthDate, tx);

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          dateOfBirth: birthDate,
          ...advanceStep(state, 'DATE_OF_BIRTH')
        },
        tx
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_STEP_DATE_OF_BIRTH',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: { dateOfBirth: birthDate.toISOString() },
          ip: context.ip
        },
        tx
      );

      return updated;
    });
  }
}
