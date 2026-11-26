import type { Repository } from 'typeorm';
import type { UserBlockProvider } from '../../../application/ports/user-block.provider.js';
import { toEntityManager } from '../../../../../common/index.js';
import type { TransactionContext } from '../../../../../common/index.js';
import { UserBlockEntity } from '../entities/user-block.entity.js';

export class UserBlockProviderAdapter implements UserBlockProvider {
  constructor(private readonly blocks: Repository<UserBlockEntity>) {}

  async listRelatedUserIds(userId: string, tx?: TransactionContext): Promise<string[]> {
    const repository = tx ? toEntityManager(tx).getRepository(UserBlockEntity) : this.blocks;
    const rows = await repository.find({
      select: { blockerId: true, blockedId: true },
      where: [{ blockerId: userId }, { blockedId: userId }]
    });
    return [
      ...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))
    ];
  }
}
