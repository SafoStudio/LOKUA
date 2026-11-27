import { AppError } from '../../../../common/index.js';
import type { AuthUser } from '../../../users/index.js';

export interface EmailChangeStore {
  save(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<void>;
  confirm(userId: string, currentEmail: string, email: string, tokenHash: string): Promise<void>;
}

export interface EmailChangeTokens {
  issue(user: AuthUser, email: string, expiresAt: Date): Promise<string>;
  read(token: string, user: AuthUser): Promise<string>;
  hash(token: string): string;
}

const confirmationLifetimeMs = 60 * 60 * 1000;

export class ChangeEmailUseCase {
  constructor(
    private readonly store: EmailChangeStore,
    private readonly tokens: EmailChangeTokens,
    private readonly sendConfirmation: (email: string, token: string) => Promise<void>
  ) {}

  async request(user: AuthUser, input: string): Promise<void> {
    const email = input.trim().toLowerCase();
    if (email === user.email) throw new AppError('Вкажіть іншу email-адресу', 422);
    const expiresAt = new Date(Date.now() + confirmationLifetimeMs);
    const token = await this.tokens.issue(user, email, expiresAt);
    await this.store.save(user.id, email, this.tokens.hash(token), expiresAt);
    await this.sendConfirmation(email, token);
  }

  async confirm(user: AuthUser, token: string): Promise<void> {
    const email = await this.tokens.read(token, user);
    await this.store.confirm(user.id, user.email, email, this.tokens.hash(token));
  }
}
