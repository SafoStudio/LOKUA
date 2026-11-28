export interface TokenPayload {
  userId: string;
  sessionVersion?: string;
}

export interface RefreshTokenPayload extends TokenPayload {
  jti: string;
}

export interface TokenService {
  signAccessToken(payload: TokenPayload): Promise<string>;

  signRefreshToken(payload: RefreshTokenPayload): Promise<string>;

  verifyAccessToken(token: string): Promise<TokenPayload>;

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}
