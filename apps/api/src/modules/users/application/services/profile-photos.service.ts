import type { UserPhotoProvider } from '../ports/user-photo.provider.js';

export class ProfilePhotosService {
  constructor(
    private readonly photos: UserPhotoProvider,
    private readonly validateOwnedUrl: (url: string, userId: string) => void
  ) {}

  list(userId: string): Promise<string[]> {
    return this.photos.list(userId);
  }

  replace(userId: string, photoUrls: string[]): Promise<void> {
    return this.photos.replace(userId, photoUrls, (url) => this.validateOwnedUrl(url, userId));
  }
}
