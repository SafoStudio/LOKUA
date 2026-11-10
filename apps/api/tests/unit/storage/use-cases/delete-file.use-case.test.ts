import { describe, it, expect, vi } from 'vitest';
import { DeleteFileUseCase } from '../../../../src/modules/storage/application/index.js';
import type { StorageService } from '../../../../src/modules/storage/application/index.js';
import { InvalidStorageKeyError } from '../../../../src/modules/storage/domain/index.js';

function createStorageMock(): StorageService {
    return {
        upload: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
        getSignedDownloadUrl: vi.fn(),
        getSignedUploadUrl: vi.fn()
    };
}

describe('DeleteFileUseCase', () => {
    it('deletes an object by a valid key', async () => {
        const storage = createStorageMock();
        const useCase = new DeleteFileUseCase(storage);

        await useCase.execute('avatars/user-1/photo.jpg');

        expect(storage.delete).toHaveBeenCalledWith('avatars/user-1/photo.jpg');
    });

    it('rejects an invalid key and does not touch the port', async () => {
        const storage = createStorageMock();
        const useCase = new DeleteFileUseCase(storage);

        await expect(useCase.execute('../secrets')).rejects.toBeInstanceOf(
            InvalidStorageKeyError
        );

        expect(storage.delete).not.toHaveBeenCalled();
    });
});