import { describe, it, expect } from 'vitest';
import { validatePasswordLength } from '../../../../src/modules/auth/application/validation/password.validation.js';
import { AppError } from '../../../../src/common/errors/app-error.js';

describe('validatePasswordLength', () => {
  it('allows passwords within 72 bytes', () => {
    expect(() => validatePasswordLength('shortPassword')).not.toThrow();
    expect(() => validatePasswordLength('a'.repeat(72))).not.toThrow();
  });

  it('rejects passwords exceeding 72 bytes (ASCII)', () => {
    expect(() => validatePasswordLength('a'.repeat(73))).toThrow(AppError);
    expect(() => validatePasswordLength('a'.repeat(73))).toThrow(
      'Password must not exceed 72 bytes'
    );
  });

  it('rejects multi-byte passwords exceeding 72 bytes even if character count <= 72', () => {
    // Each Cyrillic character is 2 bytes in UTF-8. 37 chars * 2 = 74 bytes.
    const cyrillicPassword = 'ж'.repeat(37);
    expect(cyrillicPassword.length).toBe(37);
    expect(Buffer.byteLength(cyrillicPassword, 'utf8')).toBe(74);

    expect(() => validatePasswordLength(cyrillicPassword)).toThrow(AppError);
  });
});
