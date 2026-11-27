export interface UserBlockStore {
  list(blockerId: string): Promise<{ blockedId: string; createdAt: Date }[]>;
  block(blockerId: string, blockedId: string): Promise<boolean>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
}
