import { AppError } from '../../../../common/index.js';
import type { IssueAuthTokensUseCase, AuthResult } from './issue-auth-tokens.use-case.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyCredentialRepository } from '../ports/passkey-credential.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';
import type { SecurityEventRepository } from '../ports/security-event.repository.js';
import type { SecurityContext } from '../security-context.js';

function getCredentialId(response: unknown): string {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('id' in response) ||
    typeof response.id !== 'string' ||
    response.id.length === 0
  ) {
    throw new AppError('Invalid Passkey response', 400);
  }

  return response.id;
}

export class CompletePasskeyLoginUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly challenges: PasskeyChallengeRepository,
    private readonly credentials: PasskeyCredentialRepository,
    private readonly passkey: PasskeyVerificationService,
    private readonly issueTokens: IssueAuthTokensUseCase,
    private readonly securityEvents: SecurityEventRepository
  ) {}

  async execute(
    input: { challenge: string; response: unknown },
    context: SecurityContext
  ): Promise<AuthResult> {
    const credentialId = getCredentialId(input.response);

    const challenge = await this.challenges.consume({
      challenge: input.challenge,
      type: 'AUTHENTICATION'
    });

    if (!challenge) throw new AppError('Invalid or expired Passkey challenge', 400);

    const credential = await this.credentials.findByCredentialId(credentialId);

    if (!credential) {
      await this.securityEvents.record({
        userId: null,
        eventType: 'PASSKEY_LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'unknown_credential' }
      });
      throw new AppError('Invalid Passkey credentials', 401);
    }

    const verification = await this.passkey.verifyAuthentication({
      response: input.response,
      expectedChallenge: challenge.challenge,
      credential: {
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports
      }
    });

    if (!verification) {
      await this.securityEvents.record({
        userId: credential.userId,
        eventType: 'PASSKEY_LOGIN_FAILURE',
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'verification_failed' }
      });
      throw new AppError('Passkey authentication failed', 401);
    }

    const user = await this.users.findById(credential.userId);

    if (!user) throw new AppError('User not found', 401);

    await this.credentials.updateCounter(credential.credentialId, verification.newCounter);

    await this.securityEvents.record({
      userId: user.id,
      eventType: 'PASSKEY_LOGIN_SUCCESS',
      ip: context.ip,
      userAgent: context.userAgent
    });

    return this.issueTokens.execute(user);
  }
}
