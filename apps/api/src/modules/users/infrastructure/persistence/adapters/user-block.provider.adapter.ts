import type { Repository } from 'typeorm';
import type { UserBlockProvider } from '../../../application/ports/user-block.provider.js';
import { AppError, toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { UserBlockEntity } from '../entities/user-block.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import type { UserBlockStore } from '../../../application/ports/user-block-store.js';

export class UserBlockProviderAdapter implements UserBlockProvider, UserBlockStore {
  constructor(private readonly blocks: Repository<UserBlockEntity>) {}

  list(blockerId: string): ReturnType<UserBlockStore['list']> {
    return this.blocks.find({
      select: { blockedId: true, createdAt: true },
      where: { blockerId },
      order: { createdAt: 'DESC', id: 'DESC' }
    });
  }

  block(blockerId: string, blockedId: string): Promise<boolean> {
    return this.blocks.manager.transaction(async (manager) => {
      const accounts = await manager
        .getRepository(UserEntity)
        .createQueryBuilder('account')
        .select(['account.id', 'account.status'])
        .where('account.id IN (:...ids)', { ids: [blockerId, blockedId] })
        .orderBy('account.id', 'ASC')
        .setLock('pessimistic_read')
        .getMany();
      if (accounts.find(({ id }) => id === blockerId)?.status !== 'ACTIVE') {
        throw new AppError('Account is unavailable', 403);
      }
      const target = accounts.find(({ id }) => id === blockedId);
      if (!target || target.status === 'DELETED' || target.status === 'PENDING_DELETION') {
        return false;
      }
      await manager
        .getRepository(UserBlockEntity)
        .createQueryBuilder()
        .insert()
        .values({ blockerId, blockedId })
        .orIgnore()
        .execute();
      return true;
    });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blocks.delete({ blockerId, blockedId });
  }

  async listBlockerIds(userId: string, tx?: TransactionContext): Promise<string[]> {
    const rows = await this.repository(tx).find({
      select: { blockerId: true },
      where: { blockedId: userId }
    });
    return rows.map(({ blockerId }) => blockerId);
  }

  async listBlockedIds(userId: string, tx?: TransactionContext): Promise<string[]> {
    const rows = await this.repository(tx).find({
      select: { blockedId: true },
      where: { blockerId: userId }
    });
    return rows.map(({ blockedId }) => blockedId);
  }

  async listRelatedUserIds(userId: string, tx?: TransactionContext): Promise<string[]> {
    const rows = await this.repository(tx).find({
      select: { blockerId: true, blockedId: true },
      where: [{ blockerId: userId }, { blockedId: userId }]
    });
    return [
      ...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))
    ];
  }

  private repository(tx?: TransactionContext): Repository<UserBlockEntity> {
    return tx ? toEntityManager(tx).getRepository(UserBlockEntity) : this.blocks;
  }
}
