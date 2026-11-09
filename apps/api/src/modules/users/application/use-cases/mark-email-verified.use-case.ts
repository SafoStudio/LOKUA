import type { UserRepository } from '../ports/user.repository.js';
import { AppError } from '../../../../common/index.js';

export class MarkEmailVerifiedUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<void> {
    const user = await this.users.findById(id);

    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) return;

    await this.users.markEmailVerified(id);
  }
}
