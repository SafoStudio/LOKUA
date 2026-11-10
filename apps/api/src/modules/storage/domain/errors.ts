import { AppError } from '../../../common/index.js';

export class InvalidStorageKeyError extends AppError {
  constructor(reason: string) {
    super(`Invalid storage key: ${reason}`, 400);
    this.name = 'InvalidStorageKeyError';
  }
}

export class InvalidSignedUrlTtlError extends AppError {
  constructor(reason: string) {
    super(`Invalid signed URL TTL: ${reason}`, 400);
    this.name = 'InvalidSignedUrlTtlError';
  }
}

export class InvalidContentTypeError extends AppError {
  constructor(reason: string) {
    super(`Invalid content type: ${reason}`, 400);
    this.name = 'InvalidContentTypeError';
  }
}

export class EmptyUploadError extends AppError {
  constructor() {
    super('Upload body must not be empty', 400);
    this.name = 'EmptyUploadError';
  }
}

export class UploadTooLargeError extends AppError {
  constructor(actualBytes: number, maxBytes: number) {
    super(`Upload exceeds maximum size: ${actualBytes} > ${maxBytes} bytes`, 413);
    this.name = 'UploadTooLargeError';
  }
}
