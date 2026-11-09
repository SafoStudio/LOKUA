import { createHash } from 'node:crypto';
import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';

export class LogoutUseCase {
  constructor(
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(refreshToken: string | undefined, context: SecurityContext): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await this.refreshSessions.revokeByTokenHash(tokenHash);

    await this.securityEvents.record({
      userId: null,
      eventType: 'LOGOUT',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
