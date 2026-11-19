import type { UserProfile } from '../../../users/index.js';

export interface UserProfileView {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cityId: string | null;
  interestIds: string[];
  onboardingCompleted: boolean;
  createdAt: string;
}

export function toUserProfileView(profile: UserProfile): UserProfileView {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    cityId: profile.cityId,
    interestIds: profile.interestIds,
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt.toISOString()
  };
}
