import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { accessCookieOptions, refreshCookieOptions, clearCookieOptions } from './cookies.js';
import { googleStrategy } from './google.strategy.js';
import { generateState, verifyState, stateCookieOptions, STATE_COOKIE } from './google.state.js';
import { env } from '../../config/env.js';
import { assertString } from '../../common/errors/assert.js';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, accessCookieOptions);
  res.cookie('refresh_token', refreshToken, refreshCookieOptions);
}

export const authController = {
  async register(req: Request, res: Response) {
    const { email, name, password } = req.body;
    const result = await authService.register(email, name, password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ user: result.user });
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await authService.loginWithPassword(email, password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  },

  googleStart(_req: Request, res: Response) {
    const state = generateState();
    res.cookie(STATE_COOKIE, state, stateCookieOptions);
    res.redirect(googleStrategy.buildAuthUrl(state));
  },

  async googleCallback(req: Request, res: Response) {
    const code = assertString(req.query.code, 'code');
    const state = assertString(req.query.state, 'state');

    verifyState(req.cookies?.[STATE_COOKIE], state);
    res.clearCookie(STATE_COOKIE, stateCookieOptions);

    const profile = await googleStrategy.exchangeCode(code);
    const result = await authService.loginWithGoogleProfile(profile);
    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.redirect(env.GOOGLE_SUCCESS_REDIRECT);
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.refreshToken!);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  },

  logout(_req: Request, res: Response) {
    res.clearCookie('access_token', clearCookieOptions);
    res.clearCookie('refresh_token', { ...clearCookieOptions, path: '/auth/refresh' });
    res.status(204).end();
  },

  me(req: Request, res: Response) {
    res.status(200).json({ user: req.user });
  }
};
