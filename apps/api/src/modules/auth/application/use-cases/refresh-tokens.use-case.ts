import { randomUUID, createHash } from 'node:crypto';
import type { AuthUserProvider } from '../../../users/index.js';
import type { TokenService } from '../ports/token.service.js';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';
import { logger } from '../../../../common/logger.js';
import type { AuthResult } from './issue-auth-tokens.use-case.js';

export class RefreshTokensUseCase {
  constructor(
    private readonly users: AuthUserProvider,
    private readonly tokens: TokenService,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository,
    private readonly refreshTtlMs: number
  ) {}

  async execute(refreshToken: string, context: SecurityContext): Promise<AuthResult> {
    let payload;

    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const session = await this.refreshSessions.findById(payload.jti);

    if (!session) throw new AppError('Invalid refresh token', 401);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const hashMismatch = session.tokenHash !== tokenHash;
    const replayedFamily = session.rotatedAt ? session.familyId : undefined;

    if (hashMismatch || replayedFamily) {
      logger.warn(
        { userId: session.userId, sessionId: session.id, hashMismatch },
        'Refresh token reuse detected'
      );

      if (replayedFamily && !hashMismatch) {
        await this.refreshSessions.revokeFamily(session.userId, replayedFamily);
      } else {
        await this.refreshSessions.revokeAllByUserId(session.userId);
      }

      await this.securityEvents.record({
        userId: session.userId,
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { sessionId: session.id }
      });

      throw new AppError('Invalid refresh token', 401);
    }

    if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await this.users.findById(session.userId);

    if (!user) throw new AppError('User not found', 401);
    if (
      user.status === 'PENDING_DELETION' ||
      user.status === 'DELETED' ||
      user.sessionVersion !== payload.sessionVersion
    ) {
      throw new AppError('Invalid refresh token', 401);
    }

    const newSessionId = randomUUID();
    const claims = {
      userId: user.id,
      ...(user.sessionVersion ? { sessionVersion: user.sessionVersion } : {})
    };

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokens.signAccessToken(claims),
      this.tokens.signRefreshToken({ ...claims, jti: newSessionId })
    ]);

    const newTokenHash = createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    const rotated = await this.refreshSessions.rotate(session.id, {
      id: newSessionId,
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt
    });

    if (!rotated) throw new AppError('Invalid refresh token', 401);

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken
    };
  }
}
