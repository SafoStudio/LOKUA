import type { AuthUser } from '../../domain/index.js';
import { calculateAge } from '../../domain/index.js';

export type AgeRestriction = 'NONE' | 'AGE_16' | 'AGE_18';

export class AccessService {
  canCreateEvent(user: AuthUser): boolean {
    if (user.status !== 'ACTIVE') return false;
    if (!user.emailVerified) return false;
    if (!user.onboardingCompleted) return false;

    const age = calculateAge(user.birthDate);
    return age !== null && age >= 16;
  }

  canJoinEvent(user: AuthUser, restriction: AgeRestriction): boolean {
    if (user.status !== 'ACTIVE') return false;
    if (!user.emailVerified) return false;
    if (!user.onboardingCompleted) return false;

    const age = calculateAge(user.birthDate);
    if (age === null) return false;

    if (restriction === 'AGE_18') return age >= 18;
    if (restriction === 'AGE_16') return age >= 16;
    return true;
  }

  canViewEvent(user: AuthUser | null, restriction: AgeRestriction): boolean {
    if (restriction === 'NONE') return true;
    if (!user) return false;

    const age = calculateAge(user.birthDate);
    if (age === null) return false;

    if (restriction === 'AGE_18') return age >= 18;
    return age >= 16;
  }

  canCreateEventWithRestriction(user: AuthUser, restriction: AgeRestriction): boolean {
    if (!this.canCreateEvent(user)) return false;

    const age = calculateAge(user.birthDate);
    if (age === null) return false;

    if (restriction === 'AGE_18') return age >= 18;
    if (restriction === 'AGE_16') return age >= 16;
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
