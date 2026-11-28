import type { UserProfile } from '../../users/index.js';

export function eventPerson(id: string, profile: UserProfile | null) {
  if (profile?.status === 'DELETED') return { id: null, name: profile.name, avatarUrl: null };
  if (!profile || profile.status === 'PENDING_DELETION') {
    return { id: null, name: null, avatarUrl: null };
  }
  return { id, name: profile.name, avatarUrl: profile.avatarUrl };
}
