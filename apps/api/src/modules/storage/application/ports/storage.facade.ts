import type { UploadFileInput, UploadFileResult } from './storage.service.js';

export interface SignedUrlRequestOptions {
  /**
   * Link lifetime in seconds. Defaults to STORAGE_SIGNED_URL_TTL (900s).
   * Must be between 1 and 604800 (7 days, AWS S3 hard limit).
   */
  expiresInSeconds?: number;
}

/**
 * Public contract exposed by the storage module to other modules
 * (profiles, events, ...). Implemented by the module facade; hides
 * use cases, adapter and env details.
 */
export interface StorageFacade {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  delete(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, options?: SignedUrlRequestOptions): Promise<string>;
  getSignedUploadUrl(
    key: string,
    contentType: string,
    options?: SignedUrlRequestOptions
  ): Promise<string>;
}
