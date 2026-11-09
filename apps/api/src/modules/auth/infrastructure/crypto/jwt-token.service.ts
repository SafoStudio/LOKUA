import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../../../config/env.js';
import type { TokenPayload, RefreshTokenPayload, TokenService } from '../../application/index.js';
import { AppError } from '../../../../common/index.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export class JwtTokenService implements TokenService {
  async signAccessToken(payload: TokenPayload): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(env.JWT_ACCESS_TTL)
      .sign(accessSecret);
  }

  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return new SignJWT({ userId: payload.userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setJti(payload.jti)
      .setExpirationTime(env.JWT_REFRESH_TTL)
      .sign(refreshSecret);
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    const { payload } = await jwtVerify(token, accessSecret, {
      algorithms: ['HS256']
    });

    if (typeof payload.userId !== 'string') {
      throw new AppError('Invalid access token payload');
    }

    return { userId: payload.userId };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jwtVerify(token, refreshSecret, {
      algorithms: ['HS256']
    });

    if (typeof payload.userId !== 'string' || typeof payload.jti !== 'string') {
      throw new AppError('Invalid refresh token payload');
    }

    return { userId: payload.userId, jti: payload.jti };
  }
}
