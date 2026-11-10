export interface UploadFileInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface UploadFileResult {
  key: string;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
}

/**
 * Internal contract between Application (use cases) and Infrastructure (S3 adapter).
 * `expiresInSeconds` is mandatory here: use cases resolve defaults before calling.
 */
export interface StorageService {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  delete(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, options: SignedUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, options: SignedUrlOptions): Promise<string>;
}
