import { passwordStrategy } from './password.strategy.js';
import { googleStrategy, type GoogleProfile } from './google.strategy.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js';
import { usersService } from '../users/users.service.js';
import { AppError } from '../../common/errors/app-error.js';

export type AuthResult = {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
};

async function issueTokens(
  userId: string,
  user: { id: string; email: string; name: string }
): Promise<AuthResult> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ userId }),
    signRefreshToken({ userId })
  ]);
  return { user, accessToken, refreshToken };
}

export const authService = {
  async register(email: string, name: string, password: string): Promise<AuthResult> {
    const user = await passwordStrategy.register(email, name, password);
    return issueTokens(user.id, { id: user.id, email: user.email, name: user.name });
  },

  async loginWithPassword(email: string, password: string): Promise<AuthResult> {
    const user = await passwordStrategy.verify(email, password);
    return issueTokens(user.id, { id: user.id, email: user.email, name: user.name });
  },

  async loginWithGoogleProfile(profile: GoogleProfile): Promise<AuthResult> {
    const user = await googleStrategy.loginOrRegister(profile);
    return issueTokens(user.id, { id: user.id, email: user.email, name: user.name });
  },

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
    const user = await usersService.findById(payload.userId);
    if (!user) throw new AppError('User not found', 401);
    return issueTokens(user.id, { id: user.id, email: user.email, name: user.name });
  }
};
