import { describe, it, expect } from 'vitest';
import { JwtTokenService } from '../../../../src/modules/auth/infrastructure/index.js';

describe('JwtTokenService', () => {
  const tokenService = new JwtTokenService();

  it('signs and verifies access token with valid userId payload', async () => {
    const payload = { userId: '11111111-1111-1111-1111-111111111111' };
    const token = await tokenService.signAccessToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await tokenService.verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it('signs and verifies refresh token with valid userId payload', async () => {
    const payload = { userId: '22222222-2222-2222-2222-222222222222' };
    const token = await tokenService.signRefreshToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await tokenService.verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it('fails verification when access token is verified with refresh secret or vice versa', async () => {
    const payload = { userId: '33333333-3333-3333-3333-333333333333' };
    const accessToken = await tokenService.signAccessToken(payload);

    await expect(tokenService.verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it('fails verification on malformed token string', async () => {
    await expect(tokenService.verifyAccessToken('not.a.valid.jwt')).rejects.toThrow();
    await expect(tokenService.verifyRefreshToken('not.a.valid.jwt')).rejects.toThrow();
  });
});
