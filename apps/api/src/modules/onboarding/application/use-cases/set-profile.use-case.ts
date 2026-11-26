import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import { AppError, assertString } from '../../../../common/index.js';
import type { UnitOfWork } from '../../../../common/index.js';
import type { AuditLogger } from '../../../moderation/index.js';
import type { ImageOwnership } from '../../../storage/index.js';
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
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly audit: AuditLogger,
    private readonly images?: ImageOwnership
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

    return this.unitOfWork.run(async (tx) => {
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, tx);

      if (!state.completedSteps.includes('DATE_OF_BIRTH')) {
        throw new OnboardingStepOutOfOrderError('DATE_OF_BIRTH', state.currentStep);
      }
      if (mainPhotoUrl !== state.mainPhotoUrl) {
        this.images?.assertOwnedUrl(mainPhotoUrl, context.user.id, 'PROFILE');
      }

      await this.onboardingUsers.applyProfile(context.user.id, { name, mainPhotoUrl }, tx);

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
        tx
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
        tx
      );

      return updated;
    });
  }
}
