import type { AuthUser } from '../modules/auth/domain/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      refreshToken?: string;
    }
  }
}

export {};
