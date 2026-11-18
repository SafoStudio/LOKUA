import { AppError } from '../../../../common/index.js';
import type { UserProfile, UserProfileProvider } from '../../../users/index.js';

export class GetAuthUserProfileUseCase {
  constructor(private readonly profiles: UserProfileProvider) {}

  async execute(userId: string): Promise<UserProfile> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new AppError('User not found', 404);
    return profile;
  }
}
