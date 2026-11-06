import { AppError } from '../../../../common/errors/app-error.js';
import type { PasskeyChallengeRepository } from '../ports/passkey-challenge.repository.js';
import type { PasskeyVerificationService } from '../ports/passkey-verification.service.js';
import type { PasskeySignupTransaction } from '../ports/passkey-signup-transaction.js';
import type { IssueAuthTokensUseCase, AuthResult } from './issue-auth-tokens.use-case.js';

export interface CompletePasskeySignupInput {
  challenge: string;
  response: unknown;
}

export class CompletePasskeySignupUseCase {
  constructor(
    private readonly challenges: PasskeyChallengeRepository,
    private readonly passkey: PasskeyVerificationService,
    private readonly signupTransaction: PasskeySignupTransaction,
    private readonly issueAuthTokens: IssueAuthTokensUseCase
  ) {}

  async execute(input: CompletePasskeySignupInput): Promise<AuthResult> {
    const challenge = await this.challenges.consume({
      challenge: input.challenge,
      type: 'SIGNUP'
    });

    if (!challenge) throw new AppError('Invalid or expired Passkey challenge', 400);

    if (!challenge.userId || !challenge.email || !challenge.name) {
      throw new AppError('Invalid Passkey signup challenge', 400);
    }

    const credential = await this.passkey.verifyRegistration({
      response: input.response,
      expectedChallenge: challenge.challenge
    });

    if (!credential) throw new AppError('Passkey verification failed', 400);

    const user = await this.signupTransaction.createUserWithPasskeyCredential({
      userId: challenge.userId,
      email: challenge.email,
      name: challenge.name,
      credential
    });

    return this.issueAuthTokens.execute(user);
  }
}
