import {
  InvalidContentTypeError,
  InvalidSignedUrlTtlError,
  StorageObjectKey
} from '../../domain/index.js';
import type { StorageService } from '../ports/storage.service.js';

const MAX_TTL_SECONDS = 604800;

export interface GetSignedUploadUrlCommand {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export class GetSignedUploadUrlUseCase {
  constructor(
    private readonly storage: StorageService,
    private readonly defaultTtlSeconds: number
  ) {}

  async execute(command: GetSignedUploadUrlCommand): Promise<string> {
    const key = StorageObjectKey.create(command.key);

    if (command.contentType.length === 0) {
      throw new InvalidContentTypeError('must be a non-empty string');
    }

    const expiresInSeconds = command.expiresInSeconds ?? this.defaultTtlSeconds;

    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new InvalidSignedUrlTtlError('must be a positive integer');
    }
    if (expiresInSeconds > MAX_TTL_SECONDS) {
      throw new InvalidSignedUrlTtlError(`must be at most ${MAX_TTL_SECONDS} seconds`);
    }

    return this.storage.getSignedUploadUrl(key.value, command.contentType, {
      expiresInSeconds
    });
  }
}
