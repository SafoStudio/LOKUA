import type { TransactionContext } from '../../../../common/index.js';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingState } from '../../domain/index.js';

export async function ensureOnboardingState(
  repository: OnboardingStateRepository,
  userId: string,
  tx?: TransactionContext
): Promise<OnboardingState> {
  const existing = await repository.findByUserId(userId, tx);
  if (existing) return existing;
  return repository.create(userId, tx);
}
