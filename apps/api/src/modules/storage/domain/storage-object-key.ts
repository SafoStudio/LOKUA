import { InvalidStorageKeyError } from './errors.js';

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;
const MAX_KEY_LENGTH = 1024;

export interface StorageObjectKeyProps {
  value: string;
}

export class StorageObjectKey {
  private constructor(private readonly props: StorageObjectKeyProps) {}

  static create(value: string): StorageObjectKey {
    if (typeof value !== 'string' || value.length === 0) {
      throw new InvalidStorageKeyError('must be a non-empty string');
    }
    if (value.length > MAX_KEY_LENGTH) {
      throw new InvalidStorageKeyError(`must be at most ${MAX_KEY_LENGTH} characters`);
    }
    if (value.includes('..')) {
      throw new InvalidStorageKeyError('must not contain ".."');
    }
    if (!KEY_PATTERN.test(value)) {
      throw new InvalidStorageKeyError('contains invalid characters');
    }
    return new StorageObjectKey({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
