import { randomUUID, createHash } from 'node:crypto';
import { AppError } from '../../../../common/index.js';
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
    if (user.status === 'PENDING_DELETION' || user.status === 'DELETED') {
      throw new AppError('Акаунт недоступний', 403);
    }
    const sessionId = randomUUID();
    const claims = {
      userId: user.id,
      ...(user.sessionVersion ? { sessionVersion: user.sessionVersion } : {})
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(claims),
      this.tokenService.signRefreshToken({ ...claims, jti: sessionId })
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
