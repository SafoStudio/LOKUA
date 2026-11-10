import { InvalidSignedUrlTtlError, StorageObjectKey } from '../../domain/index.js';
import type { StorageService } from '../ports/storage.service.js';

const MAX_TTL_SECONDS = 604800;

export interface GetSignedDownloadUrlCommand {
  key: string;
  expiresInSeconds?: number;
}

export class GetSignedDownloadUrlUseCase {
  constructor(
    private readonly storage: StorageService,
    private readonly defaultTtlSeconds: number
  ) {}

  async execute(command: GetSignedDownloadUrlCommand): Promise<string> {
    const key = StorageObjectKey.create(command.key);
    const expiresInSeconds = command.expiresInSeconds ?? this.defaultTtlSeconds;

    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new InvalidSignedUrlTtlError('must be a positive integer');
    }
    if (expiresInSeconds > MAX_TTL_SECONDS) {
      throw new InvalidSignedUrlTtlError(`must be at most ${MAX_TTL_SECONDS} seconds`);
    }

    return this.storage.getSignedDownloadUrl(key.value, { expiresInSeconds });
  }
}
