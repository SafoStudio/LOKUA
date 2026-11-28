import { isUniqueConstraintViolation } from '../../../../../common/index.js';
import { DictionaryConflictError } from '../../../application/admin-dictionary.js';

export async function mapDictionaryConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new DictionaryConflictError();
    }
    throw error;
  }
}
