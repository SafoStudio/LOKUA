import { env } from '../../config/env.js';
import {
  UploadFileUseCase,
  DeleteFileUseCase,
  GetSignedDownloadUrlUseCase,
  GetSignedUploadUrlUseCase
} from './application/index.js';
import type { StorageFacade } from './application/index.js';
import { S3StorageService } from './infrastructure/index.js';

export function createStorageModule() {
  const storage = new S3StorageService({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
  });

  const uploadFile = new UploadFileUseCase(storage, env.STORAGE_MAX_UPLOAD_BYTES);
  const deleteFile = new DeleteFileUseCase(storage);
  const getSignedDownloadUrl = new GetSignedDownloadUrlUseCase(storage, env.STORAGE_SIGNED_URL_TTL);
  const getSignedUploadUrl = new GetSignedUploadUrlUseCase(storage, env.STORAGE_SIGNED_URL_TTL);

  const facade: StorageFacade = {
    upload: (input) => uploadFile.execute(input),
    delete: (key) => deleteFile.execute(key),
    getSignedDownloadUrl: (key, options) =>
      getSignedDownloadUrl.execute({
        key,
        expiresInSeconds: options?.expiresInSeconds
      }),
    getSignedUploadUrl: (key, contentType, options) =>
      getSignedUploadUrl.execute({
        key,
        contentType,
        expiresInSeconds: options?.expiresInSeconds
      })
  };

  return { storage: facade };
}

export type StorageModule = ReturnType<typeof createStorageModule>;
