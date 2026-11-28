import type { RefreshSession } from '../../domain/index.js';

export interface RefreshSessionRepository {
  create(data: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;

  rotate(
    currentId: string,
    replacement: { id: string; userId: string; tokenHash: string; expiresAt: Date }
  ): Promise<boolean>;

  findById(id: string): Promise<RefreshSession | null>;

  revokeById(id: string): Promise<void>;

  revokeByTokenHash(tokenHash: string): Promise<void>;

  revokeAllByUserId(userId: string): Promise<void>;

  revokeFamily(userId: string, familyId: string): Promise<void>;
}
