import { AppError } from '../../../../common/index.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyCredentialRepository } from '../ports/passkey-credential.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';

export interface CompletePasskeyRegistrationInput {
  userId: string;
  challenge: string;
  response: unknown;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const driverError = 'driverError' in error ? error.driverError : error;

  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505'
  );
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

    try {
      await this.credentials.create({
        userId: input.userId,
        ...credential
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('Passkey already registered', 409);
      }

      throw error;
    }
  }
}
