import type { AuthUser } from '../../domain/index.js';
import type { TokenService } from '../ports/token.service.js';

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export class IssueAuthTokensUseCase {
  constructor(private readonly tokenService: TokenService) {}

  async execute(user: AuthUser): Promise<AuthResult> {
    const payload = { userId: user.id };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload)
    ]);

    return {
      user,
      accessToken,
      refreshToken
    };
  }
}
