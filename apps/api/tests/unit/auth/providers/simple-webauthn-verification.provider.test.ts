import { describe, it, expect } from 'vitest';
import { SimpleWebAuthnVerificationProvider } from '../../../../src/modules/auth/infrastructure/index.js';

describe('SimpleWebAuthnVerificationProvider', () => {
  const provider = new SimpleWebAuthnVerificationProvider({
    rpId: 'localhost',
    rpName: 'LOKUA',
    origin: 'http://localhost:5173'
  });

  it('generates registration options with challenge', async () => {
    const result = await provider.generateRegistrationOptions({
      userId: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      existingCredentials: []
    });

    expect(result.challenge).toBeDefined();
    expect(typeof result.challenge).toBe('string');
    expect(result.options).toBeDefined();

    const options = result.options as {
      challenge: string;
      rp: { id: string; name: string };
      user: { name: string; displayName: string };
    };

    expect(options.rp.name).toBe('LOKUA');
    expect(options.rp.id).toBe('localhost');
    expect(options.user.name).toBe('test@example.com');
  });

  it('excludes existing credentials in registration options', async () => {
    const result = await provider.generateRegistrationOptions({
      userId: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      existingCredentials: [
        {
          credentialId: 'existing-cred-1',
          transports: ['usb', 'ble']
        }
      ]
    });

    const options = result.options as {
      excludeCredentials?: Array<{ id: string; transports?: string[] }>;
    };

    expect(options.excludeCredentials).toBeDefined();
    expect(options.excludeCredentials).toHaveLength(1);
    expect(options.excludeCredentials?.[0].id).toBe('existing-cred-1');
  });

  it('generates authentication options with challenge', async () => {
    const result = await provider.generateAuthenticationOptions();

    expect(result.challenge).toBeDefined();
    expect(typeof result.challenge).toBe('string');
    expect(result.options).toBeDefined();
  });

  it('returns null on verifyRegistration when response is invalid or malformed', async () => {
    const result = await provider.verifyRegistration({
      response: { id: 'invalid-response' },
      expectedChallenge: 'some-challenge'
    });

    expect(result).toBeNull();
  });

  it('returns null on verifyAuthentication when response is invalid or malformed', async () => {
    const result = await provider.verifyAuthentication({
      response: { id: 'invalid-auth' },
      expectedChallenge: 'some-challenge',
      credential: {
        credentialId: 'cred-1',
        publicKey: Buffer.from('dummy-public-key'),
        counter: '0',
        transports: null
      }
    });

    expect(result).toBeNull();
  });
});
