import type { AuthUser } from '../modules/users/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      refreshToken?: string;
    }
  }
}

export {};
