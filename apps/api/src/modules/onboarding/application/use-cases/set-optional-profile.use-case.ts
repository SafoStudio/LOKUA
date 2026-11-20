import type { UserProvider, UserOnboardingProvider } from '../../../users/index.js';
import { AppError } from '../../../../common/index.js';
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

export class SetOptionalProfileUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stateRepository: OnboardingStateRepository,
    private readonly users: UserProvider,
    private readonly onboardingUsers: UserOnboardingProvider,
    private readonly audit: AuditLogger
  ) {}

  async execute(
    context: OnboardingContext,
    data: {
      bio?: unknown;
      languages?: unknown;
      socialLinks?: unknown;
    }
  ): Promise<OnboardingState> {
    if (context.user.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedError();
    }

    const patch: {
      bio?: string | null;
      languages?: string[] | null;
      socialLinks?: Record<string, string> | null;
    } = {};

    if (data.bio !== undefined) {
      if (data.bio === null) {
        patch.bio = null;
      } else {
        if (typeof data.bio !== 'string') {
          throw new AppError('bio must be a string', 400);
        }
        const bio = data.bio.trim();
        if (bio.length > 300) {
          throw new AppError('bio must be at most 300 characters', 422);
        }
        patch.bio = bio.length === 0 ? null : bio;
      }
    }

    if (data.languages !== undefined) {
      if (data.languages === null) {
        patch.languages = null;
      } else {
        if (!Array.isArray(data.languages)) {
          throw new AppError('languages must be an array', 400);
        }
        patch.languages = data.languages.map((l) => {
          if (typeof l !== 'string' || l.length === 0 || l.length > 10) {
            throw new AppError('Each language must be a non-empty string (max 10 chars)', 400);
          }
          return l;
        });
      }
    }

    if (data.socialLinks !== undefined) {
      if (data.socialLinks === null) {
        patch.socialLinks = null;
      } else {
        if (typeof data.socialLinks !== 'object' || Array.isArray(data.socialLinks)) {
          throw new AppError('socialLinks must be an object', 400);
        }
        const entries = Object.entries(data.socialLinks as Record<string, unknown>);
        const normalized: Record<string, string> = {};
        for (const [key, value] of entries) {
          if (typeof value !== 'string' || !/^https?:\/\//.test(value)) {
            throw new AppError(`socialLinks.${key} must be a valid URL`, 400);
          }
          normalized[key] = value;
        }
        patch.socialLinks = normalized;
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError('No optional fields provided', 400);
    }

    return this.unitOfWork.run(async (tx) => {
      const state = await ensureOnboardingState(this.stateRepository, context.user.id, tx);

      if (!state.completedSteps.includes('INTERESTS')) {
        throw new OnboardingStepOutOfOrderError('INTERESTS', state.currentStep);
      }

      await this.onboardingUsers.applyOptionalProfile(context.user.id, patch, tx);

      const nextCompleted = state.completedSteps.includes('OPTIONAL')
        ? state.completedSteps
        : [...state.completedSteps, 'OPTIONAL' as const];

      const updated = await this.stateRepository.updateStep(
        state.id,
        {
          bio: patch.bio !== undefined ? patch.bio : state.bio,
          languages: patch.languages !== undefined ? patch.languages : state.languages,
          socialLinks: patch.socialLinks !== undefined ? patch.socialLinks : state.socialLinks,
          currentStep: 'COMPLETED',
          completedSteps: nextCompleted
        },
        tx
      );

      await this.audit.log(
        {
          actorId: context.user.id,
          action: 'ONBOARDING_STEP_OPTIONAL',
          targetType: 'USER',
          targetId: context.user.id,
          afterState: patch as Record<string, unknown>,
          ip: context.ip
        },
        tx
      );

      return updated;
    });
  }
}
