import type { EntityManager } from 'typeorm';
import type { OnboardingState, OnboardingStep } from '../../domain/index.js';

export interface UpdateOnboardingStepData {
  currentStep?: OnboardingStep;
  completedSteps?: OnboardingStep[];
  dateOfBirth?: Date | null;
  name?: string | null;
  mainPhotoUrl?: string | null;
  cityId?: string | null;
  interestIds?: string[] | null;
  bio?: string | null;
  languages?: string[] | null;
  socialLinks?: Record<string, string> | null;
  completedAt?: Date | null;
}

export interface OnboardingStateRepository {
  findByUserId(userId: string, manager?: EntityManager): Promise<OnboardingState | null>;
  findById(id: string, manager?: EntityManager): Promise<OnboardingState | null>;
  create(userId: string, manager?: EntityManager): Promise<OnboardingState>;
  updateStep(
    id: string,
    data: UpdateOnboardingStepData,
    manager?: EntityManager
  ): Promise<OnboardingState>;
}
