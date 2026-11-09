import { describe, it, expect, vi } from 'vitest';
import { IssueAuthTokensUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
  TokenService,
  RefreshSessionRepository
} from '../../../../src/modules/auth/application/index.js';

describe('IssueAuthTokensUseCase', () => {
  const tokenService: TokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn()
  };

  const refreshSessions: RefreshSessionRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    revokeById: vi.fn(),
    revokeByTokenHash: vi.fn(),
    revokeAllByUserId: vi.fn()
  };

  const useCase = new IssueAuthTokensUseCase(tokenService, refreshSessions);

  it('issues both access and refresh tokens for user', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    };

    vi.mocked(tokenService.signAccessToken).mockResolvedValueOnce('mock-access-token');
    vi.mocked(tokenService.signRefreshToken).mockResolvedValueOnce('mock-refresh-token');

    const result = await useCase.execute(user);

    expect(result).toEqual({
      user,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    });

    expect(tokenService.signAccessToken).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', jti: expect.any(String) })
    );
    expect(refreshSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date)
        })
    );
  });
});