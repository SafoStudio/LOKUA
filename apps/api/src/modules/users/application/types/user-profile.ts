export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  cityId: string | null;
  interestIds: string[];
  onboardingCompleted: boolean;
  createdAt: Date;
}
