import type { EntityManager } from 'typeorm';

export interface UserOnboardingProvider {
  applyDateOfBirth(userId: string, birthDate: Date, manager?: EntityManager): Promise<void>;
  applyProfile(
    userId: string,
    data: { name: string; mainPhotoUrl: string },
    manager?: EntityManager
  ): Promise<void>;
  applyCity(userId: string, cityId: string, manager?: EntityManager): Promise<void>;
  applyInterests(userId: string, interestIds: string[], manager?: EntityManager): Promise<void>;
  applyOptionalProfile(
    userId: string,
    data: {
      bio?: string | null;
      languages?: string[] | null;
      socialLinks?: Record<string, string> | null;
    },
    manager?: EntityManager
  ): Promise<void>;
  completeOnboarding(userId: string, manager?: EntityManager): Promise<void>;
}
