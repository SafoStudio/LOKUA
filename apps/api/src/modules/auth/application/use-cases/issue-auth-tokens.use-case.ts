import { randomUUID, createHash } from 'node:crypto';
import type { AuthUser } from '../../../users/index.js';
import type { TokenService } from '../ports/token.service.js';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export class IssueAuthTokensUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly refreshTtlMs: number
  ) {}

  async execute(user: AuthUser): Promise<AuthResult> {
    const sessionId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken({ userId: user.id }),
      this.tokenService.signRefreshToken({ userId: user.id, jti: sessionId })
    ]);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.refreshSessions.create({
      id: sessionId,
      userId: user.id,
      tokenHash,
      expiresAt
    });

    return {
      user,
      accessToken,
      refreshToken
    };
  }
}
