import type { OnboardingState } from '../../domain/index.js';

export interface OnboardingStateView {
  id: string;
  currentStep: OnboardingState['currentStep'];
  completedSteps: OnboardingState['completedSteps'];
  completedAt: Date | null;
  dateOfBirth: string | null;
  name: string | null;
  mainPhotoUrl: string | null;
  cityId: string | null;
  interestIds: string[] | null;
  bio: string | null;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
}

export function toOnboardingStateView(state: OnboardingState): OnboardingStateView {
  return {
    id: state.id,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    completedAt: state.completedAt,
    dateOfBirth: state.dateOfBirth ? state.dateOfBirth.toISOString().slice(0, 10) : null,
    name: state.name,
    mainPhotoUrl: state.mainPhotoUrl,
    cityId: state.cityId,
    interestIds: state.interestIds,
    bio: state.bio,
    languages: state.languages,
    socialLinks: state.socialLinks
  };
}
