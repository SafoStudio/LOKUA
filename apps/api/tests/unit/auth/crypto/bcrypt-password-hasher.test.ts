import { describe, it, expect } from 'vitest';
import { BcryptPasswordHasher } from '../../../../src/modules/auth/infrastructure/index.js';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password and verifies it correctly', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hasher.hash(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await hasher.compare(password, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const password = 'CorrectPassword123!';
    const hash = await hasher.hash(password);

    const isMatch = await hasher.compare('WrongPassword456!', hash);
    expect(isMatch).toBe(false);
  });
});
