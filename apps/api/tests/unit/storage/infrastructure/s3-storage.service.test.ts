import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSignedUrlMock = vi.fn();

vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args)
}));

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand
} from '@aws-sdk/client-s3';
import { S3StorageService } from '../../../../src/modules/storage/infrastructure/index.js';

const OPTIONS = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    bucket: 'lokua',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    forcePathStyle: true
};

interface ClientLike {
    send: (command: unknown) => Promise<unknown>;
}

function createService() {
    const service = new S3StorageService(OPTIONS);
    const client = (service as unknown as { client: ClientLike }).client;
    const sendSpy = vi.spyOn(client, 'send');
    sendSpy.mockResolvedValue({});
    return { service, sendSpy };
}

describe('S3StorageService', () => {
    beforeEach(() => {
        getSignedUrlMock.mockReset();
    });

    it('uploads via PutObjectCommand', async () => {
        const { service, sendSpy } = createService();
        const body = Buffer.from('hello');

        const result = await service.upload({
            key: 'avatars/user-1/photo.jpg',
            body,
            contentType: 'image/jpeg'
        });

        expect(result).toEqual({ key: 'avatars/user-1/photo.jpg' });
        expect(sendSpy).toHaveBeenCalledTimes(1);
        const command = sendSpy.mock.calls[0]![0] as PutObjectCommand;
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toEqual({
            Bucket: 'lokua',
            Key: 'avatars/user-1/photo.jpg',
            Body: body,
            ContentType: 'image/jpeg'
        });
    });

    it('deletes via DeleteObjectCommand', async () => {
        const { service, sendSpy } = createService();

        await service.delete('avatars/user-1/photo.jpg');

        const command = sendSpy.mock.calls[0]![0] as DeleteObjectCommand;
        expect(command).toBeInstanceOf(DeleteObjectCommand);
        expect(command.input).toEqual({
            Bucket: 'lokua',
            Key: 'avatars/user-1/photo.jpg'
        });
    });

    it('returns a signed download URL via GetObjectCommand', async () => {
        const { service } = createService();
        getSignedUrlMock.mockResolvedValue('https://signed.example/download');

        const url = await service.getSignedDownloadUrl('avatars/user-1/photo.jpg', {
            expiresInSeconds: 60
        });

        expect(url).toBe('https://signed.example/download');
        expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
        const [clientArg, command, opts] = getSignedUrlMock.mock.calls[0]!;
        expect(clientArg).toBeDefined();
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect((command as GetObjectCommand).input).toEqual({
            Bucket: 'lokua',
            Key: 'avatars/user-1/photo.jpg'
        });
        expect(opts).toEqual({ expiresIn: 60 });
    });

    it('returns a signed upload URL via PutObjectCommand with content type', async () => {
        const { service } = createService();
        getSignedUrlMock.mockResolvedValue('https://signed.example/upload');

        const url = await service.getSignedUploadUrl(
            'avatars/user-1/photo.jpg',
            'image/jpeg',
            { expiresInSeconds: 120 }
        );

        expect(url).toBe('https://signed.example/upload');
        const [, command, opts] = getSignedUrlMock.mock.calls[0]!;
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect((command as PutObjectCommand).input).toEqual({
            Bucket: 'lokua',
            Key: 'avatars/user-1/photo.jpg',
            ContentType: 'image/jpeg'
        });
        expect(opts).toEqual({ expiresIn: 120 });
    });

    it('propagates errors from S3 send', async () => {
        const { service, sendSpy } = createService();
        sendSpy.mockRejectedValueOnce(new Error('S3 down'));

        await expect(
            service.upload({
                key: 'avatars/user-1/photo.jpg',
                body: Buffer.from('x'),
                contentType: 'image/jpeg'
            })
        ).rejects.toThrow('S3 down');
    });
});