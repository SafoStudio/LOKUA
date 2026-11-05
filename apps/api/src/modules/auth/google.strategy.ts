import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { AppDataSource } from '../../db/data-source.js';
import { GoogleCredential } from '../credentials/google-credential.entity.js';
import { usersService } from '../users/users.service.js';
import { AppError } from '../../common/errors/app-error.js';

const oauthClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI
});

const credentialRepo = () => AppDataSource.getRepository(GoogleCredential);

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export const googleStrategy = {
  buildAuthUrl(state: string): string {
    return oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account'
    });
  },

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.id_token) {
      throw new AppError('Google did not return id_token', 400);
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new AppError('Invalid Google profile', 400);
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email.split('@')[0]
    };
  },

  async loginOrRegister(profile: GoogleProfile) {
    if (!profile.emailVerified) {
      throw new AppError('Google email is not verified', 400);
    }

    const existingLink = await credentialRepo().findOne({
      where: { googleSub: profile.sub },
      relations: { user: true }
    });
    if (existingLink) {
      return existingLink.user;
    }

    const existingUser = await usersService.findByEmail(profile.email);
    if (existingUser) {
      throw new AppError(
        'Email already registered. Log in with password and link Google in settings.',
        409
      );
    }

    const user = await usersService.create({
      email: profile.email,
      name: profile.name,
      emailVerified: true
    });

    const credential = credentialRepo().create({
      userId: user.id,
      googleSub: profile.sub
    });
    await credentialRepo().save(credential);

    return user;
  }
};
