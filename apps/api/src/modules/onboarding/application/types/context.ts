import type { AuthUser } from '../../../users/index.js';

export interface OnboardingContext {
  user: AuthUser;
  ip: string | null;
}
