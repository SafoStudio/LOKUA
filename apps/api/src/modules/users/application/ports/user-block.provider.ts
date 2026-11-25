export interface UserBlockProvider {
  listRelatedUserIds(userId: string): Promise<string[]>;
}
