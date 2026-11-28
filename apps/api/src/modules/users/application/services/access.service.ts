import type { AuthUser } from '../../domain/index.js';
import { calculateAge } from '../../domain/index.js';
import { hasActiveCompletedProfile } from '../../domain/utils/profile-access.js';

import type { AgeRestriction } from '../../../../common/index.js';

const minimumAge: Record<AgeRestriction, number> = { ALL: 0, SIXTEEN_PLUS: 16, EIGHTEEN_PLUS: 18 };

export class AccessService {
  canPostEventContent(user: AuthUser): boolean {
    return user.role === 'USER' && hasActiveCompletedProfile(user);
  }

  canCreateEvent(user: AuthUser, now?: Date): boolean {
    return this.canCreateEventWithRestriction(user, 'ALL', now);
  }

  canJoinEvent(user: AuthUser, restriction: AgeRestriction, now?: Date): boolean {
    if (!this.canPostEventContent(user)) return false;

    const age = calculateAge(user.birthDate, now);
    if (age === null) return false;

    return restriction === 'ALL' || age >= minimumAge[restriction];
  }

  canViewEvent(user: AuthUser | null, restriction: AgeRestriction, now?: Date): boolean {
    if (restriction === 'ALL') return true;
    if (!user || this.isBlocked(user)) return false;
    if (user.role === 'ADMIN') return true;

    const age = calculateAge(user.birthDate, now);
    if (age === null) return false;

    return age >= minimumAge[restriction];
  }

  canCreateEventWithRestriction(user: AuthUser, restriction: AgeRestriction, now?: Date): boolean {
    if (!this.canPostEventContent(user)) return false;

    const age = calculateAge(user.birthDate, now);
    return age !== null && age >= Math.max(16, minimumAge[restriction]);
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
