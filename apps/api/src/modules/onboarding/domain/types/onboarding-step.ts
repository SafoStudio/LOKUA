export type OnboardingStep =
  'DATE_OF_BIRTH' | 'PROFILE' | 'CITY' | 'INTERESTS' | 'OPTIONAL' | 'COMPLETED';

export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  'DATE_OF_BIRTH',
  'PROFILE',
  'CITY',
  'INTERESTS',
  'OPTIONAL',
  'COMPLETED'
] as const;

export function isStepAfter(current: OnboardingStep, target: OnboardingStep): boolean {
  return ONBOARDING_STEP_ORDER.indexOf(target) > ONBOARDING_STEP_ORDER.indexOf(current);
}
