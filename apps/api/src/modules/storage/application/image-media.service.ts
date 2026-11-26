import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../common/index.js';
import { buildStorageKey } from '../domain/index.js';
import type { StorageFacade } from './ports/storage.facade.js';

export type ImageScope = 'PROFILE' | 'EVENT';
export const maxImageUploadBytes = 5 * 1024 * 1024;
export const imageContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageContentType = (typeof imageContentTypes)[number];
const keyPattern = /^images\/([0-9a-f-]{36})\/(profile|event)\/[0-9a-f-]{36}\.webp$/;

export interface ImageOwnership {
  assertOwnedUrl(url: string, ownerId: string, scope: ImageScope): void;
}

export class ImageMediaService implements ImageOwnership {
  private readonly baseUrl: string;

  constructor(
    private readonly storage: StorageFacade,
    private readonly processImage: (body: Buffer, contentType: ImageContentType) => Promise<Buffer>,
    appUrl: string,
    private readonly signingSecret: string,
    private readonly limit = maxImageUploadBytes
  ) {
    this.baseUrl = `${appUrl.replace(/\/+$/, '')}/api/v1/media/images`;
  }

  async upload(ownerId: string, scope: ImageScope, body: Buffer, contentType: ImageContentType) {
    if (body.length === 0) throw new AppError('Image body is required', 400);
    if (body.length > this.limit) throw new AppError('Image exceeds the upload limit', 413);
    const image = await this.processImage(body, contentType);
    if (image.length > this.limit)
      throw new AppError('Processed image exceeds the upload limit', 413);
    const key = buildStorageKey({
      entity: 'images',
      entityId: ownerId.toLowerCase(),
      kind: scope.toLowerCase(),
      extension: 'webp'
    });
    await this.storage.upload({ key, body: image, contentType: 'image/webp' });
    const token = `${Buffer.from(key).toString('base64url')}.${this.sign(key).toString('base64url')}`;
    return { url: `${this.baseUrl}/${token}`, contentType: 'image/webp' as const };
  }

  assertOwnedUrl(url: string, ownerId: string, scope: ImageScope): void {
    const token = url.startsWith(`${this.baseUrl}/`) ? url.slice(this.baseUrl.length + 1) : '';
    const key = this.parseToken(token);
    const match = key?.match(keyPattern);
    if (!match || match[1] !== ownerId.toLowerCase() || match[2] !== scope.toLowerCase()) {
      throw new AppError('Image must be uploaded by the current user for this purpose', 422);
    }
  }

  download(token: string): Promise<string> {
    const key = this.parseToken(token);
    if (!key) throw new AppError('Image not found', 404);
    return this.storage.getSignedDownloadUrl(key);
  }

  private parseToken(token: string): string | null {
    if (!/^[\w-]{1,180}\.[\w-]{43}$/.test(token)) return null;
    const [encodedKey, signature] = token.split('.');
    const key = Buffer.from(encodedKey, 'base64url').toString('utf8');
    if (!keyPattern.test(key) || Buffer.from(key).toString('base64url') !== encodedKey) return null;
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== 32 || actual.toString('base64url') !== signature) return null;
    return timingSafeEqual(this.sign(key), actual) ? key : null;
  }

  private sign(key: string): Buffer {
    return createHmac('sha256', this.signingSecret).update('media-image:').update(key).digest();
  }
}
