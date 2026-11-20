import type { DataSource } from 'typeorm';
import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import { calculateAge } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';
import type { TransactionContext } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import {
  OnboardingAlreadyCompletedError,
  OnboardingStepImmutableError
} from '../../domain/index.js';
import { ensureOnboardingState } from './ensure-onboarding-state.js';

export class SetDateOfBirthUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
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

    return this.dataSource.transaction(async (manager) => {
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, manager);

      await this.onboardingUsers.applyDateOfBirth(context.user.id, birthDate, manager);

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          dateOfBirth: birthDate,
          currentStep: 'PROFILE',
          completedSteps: [...state.completedSteps, 'DATE_OF_BIRTH']
        },
        manager
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
        // TODO: migrate onboarding to UnitOfWork; bridge EntityManager -> TransactionContext for now
        manager as unknown as TransactionContext
      );

      return updated;
    });
  }
}
