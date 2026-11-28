import { AppError } from '../../../../common/index.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyCredentialRepository } from '../ports/passkey-credential.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';

export interface CompletePasskeyRegistrationInput {
  userId: string;
  challenge: string;
  response: unknown;
}

export class CompletePasskeyRegistrationUseCase {
  constructor(
    private readonly challenges: PasskeyChallengeRepository,
    private readonly credentials: PasskeyCredentialRepository,
    private readonly passkey: PasskeyVerificationService
  ) {}

  async execute(input: CompletePasskeyRegistrationInput): Promise<void> {
    const challenge = await this.challenges.consume({
      challenge: input.challenge,
      type: 'REGISTRATION'
    });

    if (!challenge) throw new AppError('Invalid or expired Passkey challenge', 400);

    if (challenge.userId !== input.userId) {
      throw new AppError('Invalid Passkey challenge owner', 403);
    }

    const credential = await this.passkey.verifyRegistration({
      response: input.response,
      expectedChallenge: challenge.challenge
    });

    if (!credential) throw new AppError('Passkey verification failed', 400);

    await this.credentials.create({
      userId: input.userId,
      ...credential
    });
  }
}
