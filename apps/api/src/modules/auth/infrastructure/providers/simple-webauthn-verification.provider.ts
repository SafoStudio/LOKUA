import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  WebAuthnCredential
} from '@simplewebauthn/server';
import type { PasskeyVerificationService, PasskeyCredentialData } from '../../application/index.js';

interface PasskeyConfig {
  rpId: string;
  rpName: string;
  origin: string;
}

export class SimpleWebAuthnVerificationProvider implements PasskeyVerificationService {
  constructor(private readonly config: PasskeyConfig) {}

  async generateRegistrationOptions(data: {
    userId: string;
    email: string;
    name: string;
    existingCredentials: Array<{
      credentialId: string;
      transports: string[] | null;
    }>;
  }): Promise<{
    challenge: string;
    options: unknown;
  }> {
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,

      userID: new TextEncoder().encode(data.userId),
      userName: data.email,
      userDisplayName: data.name,

      attestationType: 'none',

      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
      },

      excludeCredentials: data.existingCredentials.map((credential) => ({
        id: credential.credentialId,
        ...(credential.transports
          ? {
              transports: credential.transports
            }
          : {})
      }))
    });

    return {
      challenge: options.challenge,
      options
    };
  }

  async verifyRegistration(data: {
    response: unknown;
    expectedChallenge: string;
  }): Promise<PasskeyCredentialData | null> {
    try {
      const verification = await verifyRegistrationResponse({
        response: data.response as RegistrationResponseJSON,
        expectedChallenge: data.expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId
      });

      if (!verification.verified || !verification.registrationInfo) return null;

      const credential = verification.registrationInfo.credential;

      return {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: String(credential.counter),
        transports: credential.transports ?? null,
        backedUp: verification.registrationInfo.credentialBackedUp
      };
    } catch {
      return null;
    }
  }

  async generateAuthenticationOptions(): Promise<{
    challenge: string;
    options: unknown;
  }> {
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpId,
      userVerification: 'required'
    });

    return {
      challenge: options.challenge,
      options
    };
  }

  async verifyAuthentication(data: {
    response: unknown;
    expectedChallenge: string;
    credential: {
      credentialId: string;
      publicKey: Buffer;
      counter: string;
      transports: string[] | null;
    };
  }): Promise<{ newCounter: string } | null> {
    const counter = Number(data.credential.counter);

    if (!Number.isSafeInteger(counter) || counter < 0) {
      throw new Error('Invalid stored Passkey counter');
    }

    const credential: WebAuthnCredential = {
      id: data.credential.credentialId,
      publicKey: new Uint8Array(data.credential.publicKey),
      counter,
      ...(data.credential.transports
        ? {
            transports: data.credential.transports
          }
        : {})
    };

    try {
      const verification = await verifyAuthenticationResponse({
        response: data.response as AuthenticationResponseJSON,
        expectedChallenge: data.expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
        credential
      });

      if (!verification.verified || !verification.authenticationInfo) return null;

      return {
        newCounter: String(verification.authenticationInfo.newCounter)
      };
    } catch {
      return null;
    }
  }
}
