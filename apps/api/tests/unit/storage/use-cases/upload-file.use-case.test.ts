import { describe, it, expect, vi } from 'vitest';
import { UploadFileUseCase } from '../../../../src/modules/storage/application/index.js';
import type { StorageService } from '../../../../src/modules/storage/application/index.js';
import {
    EmptyUploadError,
    InvalidContentTypeError,
    InvalidStorageKeyError,
    UploadTooLargeError
} from '../../../../src/modules/storage/domain/index.js';

const MAX_BYTES = 10 * 1024 * 1024;

function createStorageMock(): StorageService {
    return {
        upload: vi.fn().mockResolvedValue({ key: 'avatars/user-1/photo.jpg' }),
        delete: vi.fn(),
        getSignedDownloadUrl: vi.fn(),
        getSignedUploadUrl: vi.fn()
    };
}

describe('UploadFileUseCase', () => {
    it('uploads a valid file via the storage port', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, MAX_BYTES);
        const body = Buffer.from('hello');

        const result = await useCase.execute({
            key: 'avatars/user-1/photo.jpg',
            body,
            contentType: 'image/jpeg'
        });

        expect(result).toEqual({ key: 'avatars/user-1/photo.jpg' });
        expect(storage.upload).toHaveBeenCalledWith({
            key: 'avatars/user-1/photo.jpg',
            body,
            contentType: 'image/jpeg'
        });
    });

    it('rejects an invalid key', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, MAX_BYTES);

        await expect(
            useCase.execute({
                key: '../etc/passwd',
                body: Buffer.from('x'),
                contentType: 'text/plain'
            })
        ).rejects.toBeInstanceOf(InvalidStorageKeyError);

        expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects an empty content type', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, MAX_BYTES);

        await expect(
            useCase.execute({
                key: 'avatars/user-1/photo.jpg',
                body: Buffer.from('x'),
                contentType: ''
            })
        ).rejects.toBeInstanceOf(InvalidContentTypeError);

        expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects an empty body', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, MAX_BYTES);

        await expect(
            useCase.execute({
                key: 'avatars/user-1/photo.jpg',
                body: Buffer.alloc(0),
                contentType: 'image/jpeg'
            })
        ).rejects.toBeInstanceOf(EmptyUploadError);
    });

    it('rejects a body larger than the max size', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, 4);

        await expect(
            useCase.execute({
                key: 'avatars/user-1/photo.jpg',
                body: Buffer.from('12345'),
                contentType: 'image/jpeg'
            })
        ).rejects.toBeInstanceOf(UploadTooLargeError);

        expect(storage.upload).not.toHaveBeenCalled();
    });

    it('accepts a body exactly at the max size', async () => {
        const storage = createStorageMock();
        const useCase = new UploadFileUseCase(storage, 4);

        await useCase.execute({
            key: 'avatars/user-1/photo.jpg',
            body: Buffer.from('1234'),
            contentType: 'image/jpeg'
        });

        expect(storage.upload).toHaveBeenCalledTimes(1);
    });
});