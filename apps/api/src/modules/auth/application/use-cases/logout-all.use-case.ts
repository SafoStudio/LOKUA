import type { RefreshSessionRepository } from '../ports/refresh-session.repository.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';

export class LogoutAllUseCase {
  constructor(
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(userId: string, context: SecurityContext): Promise<void> {
    await this.refreshSessions.revokeAllByUserId(userId);

    await this.securityEvents.record({
      userId,
      eventType: 'LOGOUT_ALL',
      ip: context.ip,
      userAgent: context.userAgent
    });
  }
}
