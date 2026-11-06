export interface TokenPayload {
  userId: string;
}

export interface TokenService {
  signAccessToken(payload: TokenPayload): Promise<string>;

  signRefreshToken(payload: TokenPayload): Promise<string>;

  verifyAccessToken(token: string): Promise<TokenPayload>;

  verifyRefreshToken(token: string): Promise<TokenPayload>;
}
