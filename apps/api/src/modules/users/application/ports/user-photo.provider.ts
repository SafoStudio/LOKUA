export interface UserPhotoProvider {
  list(userId: string): Promise<string[]>;
  replace(userId: string, photoUrls: string[]): Promise<void>;
}
