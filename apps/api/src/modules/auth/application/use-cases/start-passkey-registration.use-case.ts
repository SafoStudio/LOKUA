import { AppError } from '../../../../common/errors/app-error.js';

import type {
  UserProvider,
  PasskeyChallengeRepository,
  PasskeyCredentialRepository,
  PasskeyVerificationService
} from '../index.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class StartPasskeyRegistrationUseCase {
  constructor(
    private readonly users: UserProvider,
    private readonly credentials: PasskeyCredentialRepository,
    private readonly challenges: PasskeyChallengeRepository,
    private readonly passkey: PasskeyVerificationService
  ) {}

  async execute(input: { userId: string }): Promise<{ options: unknown }> {
    const user = await this.users.findById(input.userId);

    if (!user) throw new AppError('User not found', 404);

    const existingCredentials = await this.credentials.findByUserId(user.id);

    const { challenge, options } = await this.passkey.generateRegistrationOptions({
      userId: user.id,
      email: user.email,
      name: user.name,
      existingCredentials: existingCredentials.map((credential) => ({
        credentialId: credential.credentialId,
        transports: credential.transports
      }))
    });

    await this.challenges.create({
      challenge,
      type: 'REGISTRATION',
      userId: user.id,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
    });

    return { options };
  }
}
