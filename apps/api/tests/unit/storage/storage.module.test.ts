import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    env: {
        STORAGE_ENDPOINT: 'http://localhost:9000',
        STORAGE_REGION: 'us-east-1',
        STORAGE_BUCKET: 'lokua',
        STORAGE_ACCESS_KEY_ID: 'minioadmin',
        STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
        STORAGE_FORCE_PATH_STYLE: true,
        STORAGE_SIGNED_URL_TTL: 900,
        STORAGE_MAX_UPLOAD_BYTES: 1024
    },
    upload: vi.fn(),
    delete: vi.fn(),
    signedDownload: vi.fn(),
    signedUpload: vi.fn(),
    s3Constructor: vi.fn()
}));

vi.mock('../../../src/config/env.js', () => ({
    env: mocks.env,
    isDev: true,
    isProduction: false,
    isSecureCookies: false
}));

vi.mock('../../../src/modules/storage/infrastructure/index.js', () => ({
    S3StorageService: function S3StorageService(options: unknown) {
        mocks.s3Constructor(options);
        return {
            upload: mocks.upload,
            delete: mocks.delete,
            getSignedDownloadUrl: mocks.signedDownload,
            getSignedUploadUrl: mocks.signedUpload
        };
    }
}));

import { createStorageModule } from '../../../src/modules/storage/index.js';
import { UploadTooLargeError } from '../../../src/modules/storage/domain/index.js';

describe('createStorageModule', () => {
    beforeEach(() => {
        mocks.upload.mockReset().mockResolvedValue({ key: 'avatars/user-1/photo.jpg' });
        mocks.delete.mockReset().mockResolvedValue(undefined);
        mocks.signedDownload
            .mockReset()
            .mockResolvedValue('https://signed.example/download');
        mocks.signedUpload.mockReset().mockResolvedValue('https://signed.example/upload');
        mocks.s3Constructor.mockReset();
    });

    it('exposes a facade with the four methods', () => {
        const { storage } = createStorageModule();
        expect(typeof storage.upload).toBe('function');
        expect(typeof storage.delete).toBe('function');
        expect(typeof storage.getSignedDownloadUrl).toBe('function');
        expect(typeof storage.getSignedUploadUrl).toBe('function');
    });

    it('constructs the S3 adapter with env config', () => {
        createStorageModule();
        expect(mocks.s3Constructor).toHaveBeenCalledWith({
            endpoint: mocks.env.STORAGE_ENDPOINT,
            region: mocks.env.STORAGE_REGION,
            bucket: mocks.env.STORAGE_BUCKET,
            accessKeyId: mocks.env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: mocks.env.STORAGE_SECRET_ACCESS_KEY,
            forcePathStyle: mocks.env.STORAGE_FORCE_PATH_STYLE
        });
    });

    it('delegates upload to the port', async () => {
        const { storage } = createStorageModule();
        const body = Buffer.from('hello');

        const result = await storage.upload({
            key: 'avatars/user-1/photo.jpg',
            body,
            contentType: 'image/jpeg'
        });

        expect(result).toEqual({ key: 'avatars/user-1/photo.jpg' });
        expect(mocks.upload).toHaveBeenCalledWith({
            key: 'avatars/user-1/photo.jpg',
            body,
            contentType: 'image/jpeg'
        });
    });

    it('delegates delete to the port', async () => {
        const { storage } = createStorageModule();

        await storage.delete('avatars/user-1/photo.jpg');

        expect(mocks.delete).toHaveBeenCalledWith('avatars/user-1/photo.jpg');
    });

    it('applies the default TTL from env when no options are provided', async () => {
        const { storage } = createStorageModule();

        await storage.getSignedDownloadUrl('avatars/user-1/photo.jpg');

        expect(mocks.signedDownload).toHaveBeenCalledWith('avatars/user-1/photo.jpg', {
            expiresInSeconds: mocks.env.STORAGE_SIGNED_URL_TTL
        });
    });

    it('passes through a custom TTL', async () => {
        const { storage } = createStorageModule();

        await storage.getSignedDownloadUrl('avatars/user-1/photo.jpg', {
            expiresInSeconds: 60
        });

        expect(mocks.signedDownload).toHaveBeenCalledWith('avatars/user-1/photo.jpg', {
            expiresInSeconds: 60
        });
    });

    it('forwards content type and TTL for signed upload', async () => {
        const { storage } = createStorageModule();

        await storage.getSignedUploadUrl('avatars/user-1/photo.jpg', 'image/jpeg', {
            expiresInSeconds: 120
        });

        expect(mocks.signedUpload).toHaveBeenCalledWith(
            'avatars/user-1/photo.jpg',
            'image/jpeg',
            { expiresInSeconds: 120 }
        );
    });

    it('rejects oversized uploads before hitting the port', async () => {
        const { storage } = createStorageModule();
        const big = Buffer.alloc(mocks.env.STORAGE_MAX_UPLOAD_BYTES + 1);

        await expect(
            storage.upload({
                key: 'avatars/user-1/photo.jpg',
                body: big,
                contentType: 'image/jpeg'
            })
        ).rejects.toBeInstanceOf(UploadTooLargeError);

        expect(mocks.upload).not.toHaveBeenCalled();
    });
});