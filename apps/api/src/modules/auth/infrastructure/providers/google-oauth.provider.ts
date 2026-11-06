import { OAuth2Client } from 'google-auth-library';
import { env } from '../../../../config/env.js';
import type { GoogleOAuthProvider, GoogleProfile } from '../../application/index.js';
import { AppError } from '../../../../common/errors/app-error.js';

export class GoogleOAuthProviderAdapter implements GoogleOAuthProvider {
  private readonly client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI
    });
  }

  buildAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account'
    });
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);

    if (!tokens.id_token) throw new AppError('Google did not return id_token', 400);

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) throw new AppError('Invalid Google profile', 400);

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email.split('@')[0]
    };
  }
}
