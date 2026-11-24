import type { AuthUser } from '../../../users/index.js';

export interface EventContext {
  user: AuthUser;
  ip: string | null;
}
