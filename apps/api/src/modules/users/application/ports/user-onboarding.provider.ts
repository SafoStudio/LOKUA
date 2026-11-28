import type { TransactionContext } from '../../../../common/index.js';

export interface UserOnboardingProvider {
  lockActiveAccount(userId: string, tx: TransactionContext): Promise<void>;
  applyDateOfBirth(userId: string, birthDate: Date, tx?: TransactionContext): Promise<void>;
  applyProfile(
    userId: string,
    data: { name: string; mainPhotoUrl: string },
    tx?: TransactionContext
  ): Promise<void>;
  applyCity(userId: string, cityId: string, tx?: TransactionContext): Promise<void>;
  applyInterests(userId: string, interestIds: string[], tx?: TransactionContext): Promise<void>;
  applyOptionalProfile(
    userId: string,
    data: {
      bio?: string | null;
      languages?: string[] | null;
      socialLinks?: Record<string, string> | null;
    },
    tx?: TransactionContext
  ): Promise<void>;
  completeOnboarding(userId: string, tx?: TransactionContext): Promise<void>;
}
