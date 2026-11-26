import sharp from 'sharp';
import { AppError } from '../../../common/index.js';
import type { ImageContentType } from '../application/image-media.service.js';

const formats = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp'
} as const;

function matchesSignature(body: Buffer, contentType: ImageContentType): boolean {
  switch (contentType) {
    case 'image/jpeg':
      return body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/png':
      return body
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
  }
}

export async function processImage(body: Buffer, contentType: ImageContentType): Promise<Buffer> {
  if (!matchesSignature(body, contentType)) throw new AppError('Unsupported image format', 415);
  try {
    const image = sharp(body, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== formats[contentType] || (metadata.pages ?? 1) !== 1) {
      throw new AppError('Unsupported image format', 415);
    }
    return await image
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Image cannot be decoded within the supported limits', 415);
  }
}
