import type { UserRole } from '../types/user-role.js';
import type { UserStatus } from '../types/user-status.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: UserRole;
  status: UserStatus;
  onboardingCompleted: boolean;
  birthDate: Date | null;
  sessionVersion?: string;
}
