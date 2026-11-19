import type { UserProfile } from '../types/user-profile.js';

export interface UserProfileProvider {
  findByUserId(userId: string): Promise<UserProfile | null>;
}
