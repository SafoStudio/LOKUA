import express from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../src/middlewares/index.js';
import type { AuthUser } from '../../../src/modules/users/index.js';
import { ImageMediaService } from '../../../src/modules/storage/application/image-media.service.js';
import type { StorageFacade } from '../../../src/modules/storage/index.js';
import { processImage } from '../../../src/modules/storage/infrastructure/process-image.js';
import { createImageMediaRouter } from '../../../src/modules/storage/presentation/http/image-media.routes.js';

const ownerId = '29d4006e-5130-4f7e-8530-c40c075b5d81';
const otherId = 'ca914ca9-cb5f-4399-bdd9-99d52774694b';
const appUrl = 'https://api.example.com';
const signingSecret = 'media-test-signing-secret-with-32-characters';

function pixels(width = 16, height = 16) {
  return sharp({ create: { width, height, channels: 3, background: '#9d3c35' } });
}

function mockStorage(): StorageFacade {
  return {
    upload: vi.fn(async ({ key }: Parameters<StorageFacade['upload']>[0]) => ({ key })),
    delete: vi.fn(),
    getSignedDownloadUrl: vi.fn(async () => 'https://storage.example.com/signed'),
    getSignedUploadUrl: vi.fn()
  };
}

describe('image processing', () => {
  it('applies EXIF orientation, resizes and strips metadata from the stored WebP', async () => {
    const original = await pixels(2200, 1000).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const processed = await processImage(original, 'image/jpeg');
    expect(await sharp(processed).metadata()).toMatchObject({ format: 'webp', height: 1920 });
    const metadata = await sharp(processed).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('accepts PNG and WebP and rejects mismatched and corrupt input', async () => {
    for (const [input, mime] of [
      [await pixels().png().toBuffer(), 'image/png'],
      [await pixels().webp().toBuffer(), 'image/webp']
    ] as const) {
      const processed = await processImage(input, mime);
      expect((await sharp(processed).metadata()).format).toBe('webp');
    }
    const png = await pixels().png().toBuffer();
    await expect(processImage(png, 'image/jpeg')).rejects.toMatchObject({ statusCode: 415 });
    await expect(processImage(png.subarray(0, 16), 'image/png')).rejects.toMatchObject({ statusCode: 415 });
  });

  it('authenticates uploads and restricts attachment URLs to their owner and scope', async () => {
    const storage = mockStorage();
    const images = new ImageMediaService(storage, processImage, appUrl, signingSecret, 1024);
    const owner: AuthUser = {
      id: ownerId, email: 'example@example.com', name: 'Photo owner', role: 'USER',
      status: 'ACTIVE', emailVerified: true, onboardingCompleted: true, birthDate: new Date('2000-01-01')
    };
    const app = express();
    app.use('/api/v1/media', createImageMediaRouter((req, res, next) => {
      if (!req.get('Authorization')) {
        res.sendStatus(401);
        return;
      }
      req.user = owner;
      next();
    }, images, 1024));
    app.use(errorHandler);
    const api = request(app);
    const path = '/api/v1/media/images?scope=PROFILE';
    const png = await pixels().png().toBuffer();
    await api.post(path).set('Content-Type', 'image/png').send(png).expect(401);
    await api.post(path).set('Authorization', 'Bearer token')
      .set('Content-Type', 'image/png').send(Buffer.alloc(1025)).expect(413);
    const created = await api.post(path).set('Authorization', 'Bearer token')
      .set('Content-Type', 'image/png').send(png).expect(201);
    const url = String(created.body.data.url);
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(() => images.assertOwnedUrl(url, ownerId, 'PROFILE')).not.toThrow();
    expect(() => images.assertOwnedUrl(url, otherId, 'PROFILE')).toThrow();
    expect(() => images.assertOwnedUrl(url, ownerId, 'EVENT')).toThrow();
    const imagePath = new URL(url).pathname;
    await api.get(imagePath).expect(302).expect('Location', 'https://storage.example.com/signed');
    await api.get(`${imagePath}x`).expect(404);
  });
});
