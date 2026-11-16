export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type UserStatus =
  'ACTIVE' | 'BLOCKED_TEMPORARY' | 'BLOCKED_PERMANENT' | 'PENDING_DELETION' | 'DELETED';

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
  notificationSettings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
