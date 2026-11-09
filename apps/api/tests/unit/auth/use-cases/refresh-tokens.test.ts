import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { RefreshTokensUseCase } from '../../../../src/modules/auth/application/index.js';
import type { UserProvider } from '../../../../src/modules/auth/index.js';
import type {
  TokenService,
  RefreshSessionRepository,
  SecurityEventRepository
} from '../../../../src/modules/auth/application/index.js';

const hashOf = (value: string): string =>
    createHash('sha256').update(value).digest('hex');

describe('RefreshTokensUseCase', () => {
  const users: UserProvider = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    markEmailVerified: vi.fn()
  };

  const tokens: TokenService = {
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

  const securityEvents: SecurityEventRepository = {
    record: vi.fn()
  };

  const context = { ip: '127.0.0.1', userAgent: 'vitest' };

  const useCase = new RefreshTokensUseCase(users, tokens, refreshSessions, securityEvents);

  it('refreshes tokens and returns user with new pair of tokens', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true
    };

    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'user-1',
      jti: 'session-1'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: hashOf('valid-refresh-token'),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null
    });
    vi.mocked(users.findById).mockResolvedValueOnce(user);
    vi.mocked(tokens.signAccessToken).mockResolvedValueOnce('new-access-token');
    vi.mocked(tokens.signRefreshToken).mockResolvedValueOnce('new-refresh-token');

    const result = await useCase.execute('valid-refresh-token', context);

    expect(result).toEqual({
      user,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    });

    expect(tokens.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(refreshSessions.findById).toHaveBeenCalledWith('session-1');
    expect(users.findById).toHaveBeenCalledWith('user-1');
    expect(refreshSessions.create).toHaveBeenCalled();
    expect(refreshSessions.revokeById).toHaveBeenCalledWith('session-1');
    expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('throws AppError 401 when token verification fails', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockRejectedValueOnce(
        new Error('signature verification failed')
    );

    await expect(useCase.execute('invalid-refresh-token', context)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });
  });

  it('throws AppError 401 when session is not found', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'user-1',
      jti: 'missing-session'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute('any-token', context)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });
  });

  it('detects reuse, revokes all sessions and records event', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'user-1',
      jti: 'session-1'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: hashOf('rotated-token'),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: new Date()
    });

    await expect(
        useCase.execute('stolen-old-token', context)
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });

    expect(refreshSessions.revokeAllByUserId).toHaveBeenCalledWith('user-1');
    expect(securityEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
          metadata: { sessionId: 'session-1' }
        })
    );
  });

  it('throws AppError 401 when session is revoked', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'user-1',
      jti: 'session-1'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: hashOf('valid-token'),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: new Date()
    });

    await expect(useCase.execute('valid-token', context)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });

    expect(refreshSessions.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('throws AppError 401 when session is expired', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'user-1',
      jti: 'session-1'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      tokenHash: hashOf('valid-token'),
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      revokedAt: null
    });

    await expect(useCase.execute('valid-token', context)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token'
    });
  });

  it('throws AppError 401 when user in token payload does not exist', async () => {
    vi.mocked(tokens.verifyRefreshToken).mockResolvedValueOnce({
      userId: 'deleted-user',
      jti: 'session-deleted'
    });
    vi.mocked(refreshSessions.findById).mockResolvedValueOnce({
      id: 'session-deleted',
      userId: 'deleted-user',
      tokenHash: hashOf('valid-token-for-deleted-user'),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null
    });
    vi.mocked(users.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute('valid-token-for-deleted-user', context)).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not found'
    });
  });
});