import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import {
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  refreshCookieOptions
} from '../../../../src/modules/auth/presentation/http/cookies.js';

describe('cookies', () => {
  it('sets access and refresh cookies with expected options', () => {
    const res = {
      cookie: vi.fn()
    } as unknown as Response;

    setAuthCookies(res, 'access-token-xyz', 'refresh-token-xyz');

    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access-token-xyz',
      accessCookieOptions
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token-xyz',
      refreshCookieOptions
    );

    expect(accessCookieOptions.httpOnly).toBe(true);
    expect(accessCookieOptions.sameSite).toBe('lax');
    expect(accessCookieOptions.path).toBe('/api/v1');

    expect(refreshCookieOptions.httpOnly).toBe(true);
    expect(refreshCookieOptions.sameSite).toBe('lax');
    expect(refreshCookieOptions.path).toBe('/api/v1/auth/refresh');
  });

  it('clears access and refresh cookies with expected paths', () => {
    const res = {
      clearCookie: vi.fn()
    } as unknown as Response;

    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, accessCookieOptions);
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, refreshCookieOptions);
  });
});
