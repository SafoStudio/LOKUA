import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class StartPasskeyLoginUseCase {
  constructor(
    private readonly challenges: PasskeyChallengeRepository,
    private readonly passkey: PasskeyVerificationService
  ) {}

  async execute(): Promise<{ options: unknown }> {
    const { challenge, options } = await this.passkey.generateAuthenticationOptions();

    await this.challenges.create({
      challenge,
      type: 'AUTHENTICATION',
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    });

    return { options };
  }
}
