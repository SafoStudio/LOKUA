import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { accessCookieOptions, refreshCookieOptions, clearCookieOptions } from './cookies.js';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, accessCookieOptions);
  res.cookie('refresh_token', refreshToken, refreshCookieOptions);
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, password } = req.body;
      const result = await authService.register(email, name, password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(201).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.loginWithPassword(email, password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.refreshToken!);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie('access_token', clearCookieOptions);
    res.clearCookie('refresh_token', { ...clearCookieOptions, path: '/auth/refresh' });
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    res.status(200).json({ user: req.user });
  }
};
