import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingContext } from '../types/context.js';
import type { OnboardingState } from '../../domain/index.js';
import { ensureOnboardingState } from './ensure-onboarding-state.js';

export class GetOnboardingStateUseCase {
  constructor(private readonly stateRepository: OnboardingStateRepository) {}

  async execute(context: OnboardingContext): Promise<OnboardingState> {
    return ensureOnboardingState(this.stateRepository, context.user.id);
  }
}
