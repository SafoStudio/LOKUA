import { describe, it, expect } from 'vitest';
import type { CookieOptions, Request, Response } from 'express';
import {
  createGoogleState,
  setGoogleStateCookie,
  clearGoogleStateCookie,
  verifyGoogleState,
  GOOGLE_STATE_COOKIE,
  googleStateCookieOptions
} from '../../../../src/modules/auth/presentation/http/google.state.js';
import { AppError } from '../../../../src/common/errors/app-error.js';

describe('google.state', () => {
  it('creates 64-char hex random state', () => {
    const state1 = createGoogleState();
    const state2 = createGoogleState();

    expect(state1).toHaveLength(64);
    expect(state2).toHaveLength(64);
    expect(state1).not.toBe(state2);
  });

  it('sets and clears state cookie with correct path and options', () => {
    const cookieCalls: Array<{ name: string; val: string; opts?: CookieOptions }> = [];
    const clearCalls: Array<{ name: string; opts?: CookieOptions }> = [];

    const resMock = {
      cookie: ((name: string, val: string, opts?: CookieOptions) => {
        cookieCalls.push({ name, val, opts });
        return resMock;
      }) as Response['cookie'],

      clearCookie: ((name: string, opts?: CookieOptions) => {
        clearCalls.push({ name, opts });
        return resMock;
      }) as Response['clearCookie']
    } as unknown as Response;

    const state = createGoogleState();
    setGoogleStateCookie(resMock, state);

    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]).toEqual({
      name: GOOGLE_STATE_COOKIE,
      val: state,
      opts: googleStateCookieOptions
    });

    clearGoogleStateCookie(resMock);
    expect(clearCalls).toHaveLength(1);
    expect(clearCalls[0].name).toBe(GOOGLE_STATE_COOKIE);
  });

  it('verifies state successfully when cookie matches received state', () => {
    const state = createGoogleState();
    const req = {
      cookies: {
        [GOOGLE_STATE_COOKIE]: state
      }
    } as unknown as Request;

    expect(() => verifyGoogleState(req, state)).not.toThrow();
  });

  it('throws AppError 400 when cookie state is missing', () => {
    const req = {
      cookies: {}
    } as unknown as Request;

    expect(() => verifyGoogleState(req, 'some-state')).toThrow(AppError);
    expect(() => verifyGoogleState(req, 'some-state')).toThrow('Invalid OAuth state');
  });

  it('throws AppError 400 when states do not match', () => {
    const req = {
      cookies: {
        [GOOGLE_STATE_COOKIE]: createGoogleState()
      }
    } as unknown as Request;

    expect(() => verifyGoogleState(req, createGoogleState())).toThrow(AppError);
  });
});