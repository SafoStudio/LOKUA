import { AppError } from '../../../common/index.js';

export class OnboardingAlreadyCompletedError extends AppError {
  constructor() {
    super('Onboarding already completed', 409);
    this.name = 'OnboardingAlreadyCompletedError';
  }
}

export class OnboardingStepOutOfOrderError extends AppError {
  constructor(expected: string, actual: string) {
    super(`Onboarding step out of order: expected ${expected}, got ${actual}`, 409);
    this.name = 'OnboardingStepOutOfOrderError';
  }
}

export class OnboardingStepImmutableError extends AppError {
  constructor(step: string) {
    super(`Onboarding step ${step} cannot be repeated`, 409);
    this.name = 'OnboardingStepImmutableError';
  }
}

export class OnboardingIncompleteError extends AppError {
  constructor(missing: string[]) {
    super(`Onboarding incomplete: missing ${missing.join(', ')}`, 422);
    this.name = 'OnboardingIncompleteError';
  }
}
