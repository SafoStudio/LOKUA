import { describe, it, expect, vi } from 'vitest';
import { IssueAuthTokensUseCase } from '../../../../src/modules/auth/application/index.js';
import type {
  TokenService,
  RefreshSessionRepository
} from '../../../../src/modules/auth/application/index.js';
import {createMockAuthUser} from "../../../fixtures/users.fixture.js";

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
    rotate: vi.fn().mockResolvedValue(true),
    revokeByTokenHash: vi.fn(),
    revokeAllByUserId: vi.fn(),
    revokeFamily: vi.fn()
  };

  const useCase = new IssueAuthTokensUseCase(tokenService, refreshSessions, 7 * 24 * 60 * 60 * 1000);

  it('issues both access and refresh tokens for user', async () => {
    const mockUser = createMockAuthUser({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    });

    vi.mocked(tokenService.signAccessToken).mockResolvedValueOnce('mock-access-token');
    vi.mocked(tokenService.signRefreshToken).mockResolvedValueOnce('mock-refresh-token');

    const result = await useCase.execute(mockUser);

    expect(result).toEqual({
      user: mockUser,
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
