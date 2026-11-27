import type { UserStatus } from '../../domain/index.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  photoUrls?: string[];
  cityId: string | null;
  interestIds: string[];
  onboardingCompleted: boolean;
  createdAt: Date;
  status?: UserStatus;
  bio?: string | null;
  languages?: string[] | null;
  socialLinks?: Record<string, string> | null;
}
