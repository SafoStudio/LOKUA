import type { AuthUser } from '../../domain/index.js';
import { calculateAge } from '../../domain/index.js';

import type { AgeRestriction } from '../../../../common/index.js';

export class AccessService {
  canPostEventContent(user: AuthUser): boolean {
    return (
      user.role === 'USER' &&
      user.status === 'ACTIVE' &&
      user.emailVerified &&
      user.onboardingCompleted
    );
  }

  canCreateEvent(user: AuthUser, now?: Date): boolean {
    if (user.status !== 'ACTIVE') return false;
    if (!user.emailVerified) return false;
    if (!user.onboardingCompleted) return false;

    const age = calculateAge(user.birthDate, now);
    return age !== null && age >= 16;
  }

  canJoinEvent(user: AuthUser, restriction: AgeRestriction, now?: Date): boolean {
    if (user.status !== 'ACTIVE') return false;
    if (!user.emailVerified) return false;
    if (!user.onboardingCompleted) return false;

    const age = calculateAge(user.birthDate, now);
    if (age === null) return false;

    if (restriction === 'EIGHTEEN_PLUS') return age >= 18;
    if (restriction === 'SIXTEEN_PLUS') return age >= 16;
    return true;
  }

  canViewEvent(user: AuthUser | null, restriction: AgeRestriction, now?: Date): boolean {
    if (restriction === 'ALL') return true;
    if (!user || this.isBlocked(user)) return false;

    const age = calculateAge(user.birthDate, now);
    if (age === null) return false;

    if (restriction === 'EIGHTEEN_PLUS') return age >= 18;
    return age >= 16;
  }

  canCreateEventWithRestriction(user: AuthUser, restriction: AgeRestriction, now?: Date): boolean {
    if (!this.canCreateEvent(user, now)) return false;

    const age = calculateAge(user.birthDate, now);
    if (age === null) return false;

    if (restriction === 'EIGHTEEN_PLUS') return age >= 18;
    if (restriction === 'SIXTEEN_PLUS') return age >= 16;
    return true;
  }

  isBlocked(user: AuthUser): boolean {
    return user.status !== 'ACTIVE';
  }

  canAccessAdmin(user: AuthUser, requiredRole: 'MODERATOR' | 'ADMIN'): boolean {
    if (user.status !== 'ACTIVE') return false;
    if (requiredRole === 'ADMIN') return user.role === 'ADMIN';
    return user.role === 'ADMIN' || user.role === 'MODERATOR';
  }
}
