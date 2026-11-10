import { describe, it, expect, vi } from 'vitest';
import { GetSignedDownloadUrlUseCase } from '../../../../src/modules/storage/application/index.js';
import type { StorageService } from '../../../../src/modules/storage/application/index.js';
import {
    InvalidSignedUrlTtlError,
    InvalidStorageKeyError
} from '../../../../src/modules/storage/domain/index.js';

const DEFAULT_TTL = 900;
const MAX_TTL = 604800;

function createStorageMock(): StorageService {
    return {
        upload: vi.fn(),
        delete: vi.fn(),
        getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed.example/download'),
        getSignedUploadUrl: vi.fn()
    };
}

describe('GetSignedDownloadUrlUseCase', () => {
    it('uses the default TTL when none is provided', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        const url = await useCase.execute({ key: 'avatars/user-1/photo.jpg' });

        expect(url).toBe('https://signed.example/download');
        expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('avatars/user-1/photo.jpg', {
            expiresInSeconds: DEFAULT_TTL
        });
    });

    it('uses the provided TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: 60 });

        expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('avatars/user-1/photo.jpg', {
            expiresInSeconds: 60
        });
    });

    it('accepts exactly the maximum TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: MAX_TTL });

        expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('avatars/user-1/photo.jpg', {
            expiresInSeconds: MAX_TTL
        });
    });

    it('rejects a zero TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: 0 })
        ).rejects.toBeInstanceOf(InvalidSignedUrlTtlError);

        expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('rejects a negative TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: -10 })
        ).rejects.toBeInstanceOf(InvalidSignedUrlTtlError);
    });

    it('rejects a TTL above 7 days', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: MAX_TTL + 1 })
        ).rejects.toBeInstanceOf(InvalidSignedUrlTtlError);
    });

    it('rejects a non-integer TTL', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await expect(
            useCase.execute({ key: 'avatars/user-1/photo.jpg', expiresInSeconds: 1.5 })
        ).rejects.toBeInstanceOf(InvalidSignedUrlTtlError);
    });

    it('rejects an invalid key', async () => {
        const storage = createStorageMock();
        const useCase = new GetSignedDownloadUrlUseCase(storage, DEFAULT_TTL);

        await expect(useCase.execute({ key: '' })).rejects.toBeInstanceOf(
            InvalidStorageKeyError
        );
    });
});