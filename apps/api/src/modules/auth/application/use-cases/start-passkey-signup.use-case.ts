import { randomUUID } from 'node:crypto';
import { AppError } from '../../../../common/errors/app-error.js';
import type { UserProvider } from '../ports/user.provider.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface StartPasskeySignupInput {
  email: string;
  name: string;
}

export interface StartPasskeySignupResult {
  options: unknown;
}

export class StartPasskeySignupUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly challenges: PasskeyChallengeRepository,
    private readonly passkey: PasskeyVerificationService
  ) {}

  async execute(input: StartPasskeySignupInput): Promise<StartPasskeySignupResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    const existingUser = await this.users.findByEmail(email);

    if (existingUser) throw new AppError('Email already registered', 409);

    const userId = randomUUID();

    const { challenge, options } = await this.passkey.generateRegistrationOptions({
      userId,
      email,
      name,
      existingCredentials: []
    });

    await this.challenges.create({
      challenge,
      type: 'SIGNUP',
      userId,
      email,
      name,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    });

    return { options };
  }
}
