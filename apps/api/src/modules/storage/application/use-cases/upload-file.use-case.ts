import {
  EmptyUploadError,
  InvalidContentTypeError,
  StorageObjectKey,
  UploadTooLargeError
} from '../../domain/index.js';
import type { StorageService, UploadFileResult } from '../ports/storage.service.js';

export interface UploadFileCommand {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export class UploadFileUseCase {
  constructor(
    private readonly storage: StorageService,
    private readonly maxUploadBytes: number
  ) {}

  async execute(command: UploadFileCommand): Promise<UploadFileResult> {
    const key = StorageObjectKey.create(command.key);

    if (command.contentType.length === 0) {
      throw new InvalidContentTypeError('must be a non-empty string');
    }

    const size = command.body.byteLength;
    if (size === 0) {
      throw new EmptyUploadError();
    }
    if (size > this.maxUploadBytes) {
      throw new UploadTooLargeError(size, this.maxUploadBytes);
    }

    return this.storage.upload({
      key: key.value,
      body: command.body,
      contentType: command.contentType
    });
  }
}
