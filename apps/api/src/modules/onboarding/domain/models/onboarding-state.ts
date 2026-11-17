import type { OnboardingStep } from '../types/onboarding-step.js';

export interface OnboardingState {
  id: string;
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  dateOfBirth: Date | null;
  name: string | null;
  mainPhotoUrl: string | null;
  cityId: string | null;
  interestIds: string[] | null;
  bio: string | null;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
