import { describe, it, expect, vi } from 'vitest';
import { RefreshTokensUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type { TokenService } from '../../../../src/modules/auth/application/index.js';

describe('RefreshTokensUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn()
  };

  const tokens: TokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn()
  };

  const useCase = new RefreshTokensUseCase(users, tokens);

  it('refreshes tokens and returns user with new pair of tokens', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    };

    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({ userId: 'user-1' });
    vi.mocked(users.findById).mockResolvedValueOnce(user);
    vi.mocked(tokens.signAccessToken).mockResolvedValueOnce('new-access-token');
    vi.mocked(tokens.signRefreshToken).mockResolvedValueOnce('new-refresh-token');

    const result = await useCase.execute('valid-refresh-token');

    expect(result).toEqual({
      user,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    });

    expect(tokens.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(users.findById).toHaveBeenCalledWith('user-1');
  });

  it('throws AppError 401 when token verification fails', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockRejectedValueOnce(
      new Error('signature verification failed')
    );

    await expect(useCase.execute('invalid-refresh-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });
  });

  it('throws AppError 401 when user in token payload does not exist', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({ userId: 'deleted-user' });
    vi.mocked(users.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute('valid-token-for-deleted-user')).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not found'
    });
  });
});
