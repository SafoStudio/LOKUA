import type { UserRole } from '../types/user-role.js';
import type { UserStatus } from '../types/user-status.js';

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  birthDate: Date | null;
  role: UserRole;
  status: UserStatus;
  cityId: string | null;
  bio: string | null;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
  onboardingCompleted: boolean;
  termsAcceptedAt: Date | null;
  blockedUntil: Date | null;
  deletionRequestedAt: Date | null;
  sessionVersion?: string;
  notificationSettings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
