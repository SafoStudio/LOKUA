import { randomUUID, createHash } from 'node:crypto';
import type { UserProvider } from '../ports/user.provider.js';
import type { TokenService } from '../ports/token.service.js';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';
import { AppError } from '../../../../common/index.js';
import { env } from '../../../../config/env.js';
import { logger } from '../../../../common/logger.js';
import { parseTtlToMs } from './parse-ttl.js';
import type { AuthResult } from './issue-auth-tokens.use-case.js';

export class RefreshTokensUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly tokens: TokenService,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository
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

    if (session.tokenHash !== tokenHash) {
      logger.warn(
        { userId: session.userId, sessionId: session.id },
        'Refresh token reuse detected, revoking all sessions'
      );

      await this.securityEvents.record({
        userId: session.userId,
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { sessionId: session.id }
      });

      await this.refreshSessions.revokeAllByUserId(session.userId);

      throw new AppError('Invalid refresh token', 401);
    }

    if (session.revokedAt !== null) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await this.users.findById(session.userId);

    if (!user) throw new AppError('User not found', 401);

    const newSessionId = randomUUID();

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokens.signAccessToken({ userId: user.id }),
      this.tokens.signRefreshToken({ userId: user.id, jti: newSessionId })
    ]);

    const newTokenHash = createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseTtlToMs(env.JWT_REFRESH_TTL));

    await this.refreshSessions.create({
      id: newSessionId,
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt
    });

    await this.refreshSessions.revokeById(session.id);

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken
    };
  }
}
