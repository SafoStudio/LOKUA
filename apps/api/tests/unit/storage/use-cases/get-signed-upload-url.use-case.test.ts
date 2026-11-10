import { describe, it, expect, vi } from 'vitest';
import { GetSignedUploadUrlUseCase } from '../../../../src/modules/storage/application/index.js';
import type { StorageService } from '../../../../src/modules/storage/application/index.js';
import {
    InvalidContentTypeError,
    InvalidSignedUrlTtlError,
    InvalidStorageKeyError
} from '../../../../src/modules/storage/domain/index.js';

const DEFAULT_TTL = 900;
const MAX_TTL = 604800;

function createStorageMock(): StorageService {
    return {
        upload: vi.fn(),
        delete: vi.fn(),
        getSignedDownloadUrl: vi.fn(),
        getSignedUploadUrl: vi.fn().mockResolvedValue('https://signed.example/upload')
    };
}

describe('GetSignedUploadUrlUseCase', () => {
    it('uses the default TTL and forwards the content type', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        const url = await useCase.execute({
            key: 'avatars/user-1/photo.jpg',
            contentType: 'image/jpeg'
        });

        expect(url).toBe('https://signed.example/upload');
        expect(storage.getSignedUploadUrl).toHaveBeenCalledWith(
            'avatars/user-1/photo.jpg',
            'image/jpeg',
            { expiresInSeconds: DEFAULT_TTL }
        );
    });

    it('uses the provided TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        await useCase.execute({
            key: 'avatars/user-1/photo.jpg',
            contentType: 'image/jpeg',
            expiresInSeconds: 120
        });

        expect(storage.getSignedUploadUrl).toHaveBeenCalledWith(
            'avatars/user-1/photo.jpg',
            'image/jpeg',
            { expiresInSeconds: 120 }
        );
    });

    it('rejects an empty content type', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: 'avatars/user-1/photo.jpg', contentType: '' })
        ).rejects.toBeInstanceOf(InvalidContentTypeError);

        expect(storage.getSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('accepts exactly the maximum TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        await useCase.execute({
            key: 'avatars/user-1/photo.jpg',
            contentType: 'image/jpeg',
            expiresInSeconds: MAX_TTL
        });

        expect(storage.getSignedUploadUrl).toHaveBeenCalledWith(
            'avatars/user-1/photo.jpg',
            'image/jpeg',
            { expiresInSeconds: MAX_TTL }
        );
    });

    it('rejects a TTL above 7 days', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({
                key: 'avatars/user-1/photo.jpg',
                contentType: 'image/jpeg',
                expiresInSeconds: MAX_TTL + 1
            })
        ).rejects.toBeInstanceOf(InvalidSignedUrlTtlError);
    });

    it('rejects an invalid key', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedUploadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: '/abs', contentType: 'image/jpeg' })
        ).rejects.toBeInstanceOf(InvalidStorageKeyError);
    });
});