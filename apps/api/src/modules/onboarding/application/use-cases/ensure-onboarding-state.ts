import type { TransactionContext } from '../../../../common/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import { OnboardingAlreadyCompletedError } from '../../domain/index.js';
import type { OnboardingState } from '../../domain/index.js';

export async function ensureOnboardingState(
  repository: OnboardingStateRepository,
  userId: string,
  tx?: TransactionContext
): Promise<OnboardingState> {
  const state =
    (await repository.findByUserId(userId, tx)) ?? (await repository.create(userId, tx));
  if (tx && state.completedAt != null) throw new OnboardingAlreadyCompletedError();
  return state;
}
