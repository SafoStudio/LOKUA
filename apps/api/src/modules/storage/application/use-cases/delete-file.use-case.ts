import { StorageObjectKey } from '../../domain/index.js';
import type { StorageService } from '../ports/storage.service.js';

export class DeleteFileUseCase {
  constructor(private readonly storage: StorageService) {}

  async execute(keyValue: string): Promise<void> {
    const key = StorageObjectKey.create(keyValue);
    await this.storage.delete(key.value);
  }
}
