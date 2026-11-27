import { AppError } from '../../../../common/index.js';
import type { UserBlockStore } from '../ports/user-block-store.js';

export class UserBlockService {
  constructor(private readonly store: UserBlockStore) {}

  async list(userId: string) {
    const rows = await this.store.list(userId);
    return rows.map(({ blockedId, createdAt }) => ({ userId: blockedId, createdAt }));
  }

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) throw new AppError('Неможливо заблокувати себе', 422);
    if (!(await this.store.block(userId, targetId))) {
      throw new AppError('Користувача не знайдено', 404);
    }
  }

  unblock(userId: string, targetId: string): Promise<void> {
    return this.store.unblock(userId, targetId);
  }
}
