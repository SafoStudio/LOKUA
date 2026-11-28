import type { OnboardingState } from './models/onboarding-state.js';
import { isStepAfter, ONBOARDING_STEP_ORDER } from './types/onboarding-step.js';
import type { OnboardingStep } from './types/onboarding-step.js';

export function advanceStep(state: OnboardingState, step: Exclude<OnboardingStep, 'COMPLETED'>) {
  const next = ONBOARDING_STEP_ORDER[ONBOARDING_STEP_ORDER.indexOf(step) + 1];
  return {
    currentStep: isStepAfter(state.currentStep, next) ? next : state.currentStep,
    completedSteps: state.completedSteps.includes(step)
      ? state.completedSteps
      : [...state.completedSteps, step]
  };
}
