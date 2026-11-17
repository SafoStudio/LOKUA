import type { AuthUser, User } from '../../../users/index.js';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    role: user.role,
    status: user.status,
    onboardingCompleted: user.onboardingCompleted,
    birthDate: user.birthDate
  };
}
