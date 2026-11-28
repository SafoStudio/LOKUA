import type { UserStatus } from '../types/user-status.js';

export function hasActiveCompletedProfile(user: {
  status: UserStatus;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}): boolean {
  return user.status === 'ACTIVE' && user.emailVerified && user.onboardingCompleted;
}
