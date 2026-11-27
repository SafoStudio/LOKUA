import type { Repository } from 'typeorm';
import type { UserBlockProvider } from '../../../application/ports/user-block.provider.js';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { UserBlockEntity } from '../entities/user-block.entity.js';
import { UserEntity } from '../entities/user.entity.js';

export class UserBlockProviderAdapter implements UserBlockProvider {
  constructor(private readonly blocks: Repository<UserBlockEntity>) {}

  list(blockerId: string): Promise<UserBlockEntity[]> {
    return this.blocks.find({
      where: { blockerId },
      order: { createdAt: 'DESC', id: 'DESC' }
    });
  }

  async block(blockerId: string, blockedId: string): Promise<boolean> {
    const targetExists = await this.blocks.manager
      .getRepository(UserEntity)
      .existsBy({ id: blockedId });
    if (!targetExists) return false;
    await this.blocks
      .createQueryBuilder()
      .insert()
      .values({ blockerId, blockedId })
      .orIgnore()
      .execute();
    return true;
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
