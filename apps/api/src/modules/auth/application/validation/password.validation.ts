import { AppError } from '../../../../common/index.js';

const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function validatePasswordLength(password: string): void {
  const byteLength = Buffer.byteLength(password, 'utf8');

  if (byteLength > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new AppError('Password must not exceed 72 bytes', 400);
  }
}
