import type { UserProvider } from '../ports/user.provider.js';
import type { TokenService } from '../ports/token.service.js';
import { AppError } from '../../../../common/index.js';
import type { AuthResult } from './issue-auth-tokens.use-case.js';

export class RefreshTokensUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly tokens: TokenService
  ) {}

  async execute(refreshToken: string): Promise<AuthResult> {
    let payload;

    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await this.users.findById(payload.userId);

    if (!user) throw new AppError('User not found', 401);

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokens.signAccessToken({ userId: user.id }),
      this.tokens.signRefreshToken({ userId: user.id })
    ]);

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken
    };
  }
}
