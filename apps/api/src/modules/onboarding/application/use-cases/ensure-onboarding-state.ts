import type { EntityManager } from 'typeorm';
import type { OnboardingStateRepository } from '../ports/onboarding-state.repository.js';
import type { OnboardingState } from '../../domain/index.js';

export async function ensureOnboardingState(
  repository: OnboardingStateRepository,
  userId: string,
  manager?: EntityManager
): Promise<OnboardingState> {
  const existing = await repository.findByUserId(userId, manager);
  if (existing) return existing;
  return repository.create(userId, manager);
}
