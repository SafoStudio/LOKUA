import type { UserProfile } from '../../../users/index.js';

export interface UserProfileView {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
  cityId: string | null;
  interestIds: string[];
  onboardingCompleted: boolean;
  createdAt: string;
}

export function toUserProfileView(profile: UserProfile, emailVerified: boolean): UserProfileView {
  return {
    id: profile.id,
    email: profile.email,
    emailVerified,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    cityId: profile.cityId,
    interestIds: profile.interestIds,
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt.toISOString()
  };
}
