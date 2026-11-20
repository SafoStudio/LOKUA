import type { DataSource } from 'typeorm';
import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import { AppError, assertString } from '../../../../common/index.js';
import type { TransactionContext } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import {
  OnboardingAlreadyCompletedError,
  OnboardingStepOutOfOrderError
} from '../../domain/index.js';
import { ensureOnboardingState } from './ensure-onboarding-state.js';

export class SetProfileUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(
    context: OnboardingContext,
    data: { name: unknown; mainPhotoUrl: unknown }
  ): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    const name = assertString(data.name, 'name').trim();
    if (name.length < 1 || name.length > 100) {
      throw new AppError('Name must be 1-100 characters', 422);
    }

    const mainPhotoUrl = assertString(data.mainPhotoUrl, 'mainPhotoUrl').trim();
    if (!/^https?:\/\//.test(mainPhotoUrl)) {
      throw new AppError('mainPhotoUrl must be a valid URL', 422);
    }

    return this.dataSource.transaction(async (manager) => {
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, manager);

      if (!state.completedSteps.includes('DATE_OF_BIRTH')) {
        throw new OnboardingStepOutOfOrderError('DATE_OF_BIRTH', state.currentStep);
      }

      await this.onboardingUsers.applyProfile(context.user.id, { name, mainPhotoUrl }, manager);

      const nextCompleted = state.completedSteps.includes('PROFILE')
        ? state.completedSteps
        : [...state.completedSteps, 'PROFILE' as const];

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          name,
          mainPhotoUrl,
          currentStep: 'CITY',
          completedSteps: nextCompleted
        },
        manager
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_STEP_PROFILE',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: { name, mainPhotoUrl },
          ip: context.ip
        },
        // TODO: migrate onboarding to UnitOfWork; bridge EntityManager -> TransactionContext for now
        manager as unknown as TransactionContext
      );

      return updated;
    });
  }
}
