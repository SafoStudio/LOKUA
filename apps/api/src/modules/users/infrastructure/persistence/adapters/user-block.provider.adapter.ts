import type { Repository } from 'typeorm';
import type { UserBlockProvider } from '../../../application/ports/user-block.provider.js';
import type { UserBlockEntity } from '../entities/user-block.entity.js';

export class UserBlockProviderAdapter implements UserBlockProvider {
  constructor(private readonly blocks: Repository<UserBlockEntity>) {}

  async listRelatedUserIds(userId: string): Promise<string[]> {
    const rows = await this.blocks.find({
      select: { blockerId: true, blockedId: true },
      where: [{ blockerId: userId }, { blockedId: userId }]
    });
    return [
      ...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))
    ];
  }
}
