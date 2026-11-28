import { createUsersModule } from '../../src/modules/users/index.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { createTestDataSource, clearAllTables, TEST_DATABASE_URL } from './helpers/test-db.js';
import { UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import {
  PasswordCredentialEntity,
  PasswordCredentialRepositoryAdapter,
  PasswordResetTokenEntity,
  GoogleCredentialEntity,
  GoogleCredentialRepositoryAdapter,
  PasskeyCredentialEntity,
  PasskeyCredentialRepositoryAdapter,
  PasskeyChallengeEntity,
  PasskeyChallengeRepositoryAdapter,
  RefreshSessionEntity,
  RefreshSessionRepositoryAdapter,
  TypeOrmRegistrationTransaction,
  TypeOrmGoogleLoginTransaction,
  TypeOrmPasskeySignupTransaction,
} from '../../src/modules/auth/infrastructure/index.js';
import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createSharedAuthRateLimit } from '../../src/modules/auth/infrastructure/persistence/adapters/auth-rate-limit.js';
import { createAuthModule } from '../../src/modules/auth/index.js';
import { createApp as createApiApp } from '../../src/app.js';
import { JwtTokenService } from '../../src/modules/auth/infrastructure/index.js';

describe('Database & Transactions Integration Tests', () => {
  let dataSource: DataSource;
  let dbAvailable = false;

  beforeAll(async () => {
    dataSource = createTestDataSource();

    try {
      await dataSource.initialize();
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    if (dbAvailable && dataSource.isInitialized) {
      await clearAllTables(dataSource);
    }
  });

  it('verifies integration test environment status', () => {
    if (!dbAvailable) {
      console.warn(
          `[INTEGRATION] PostgreSQL test database not reachable at ${TEST_DATABASE_URL}. Start the db-test container to run the full DB integration suite.`
      );
    }
    expect(true).toBe(true);
  });

  describe('When PostgreSQL test database is reachable', () => {
    it('keeps the reset token on failed password update and invalidates access on success', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const users = createUsersModule({ dataSource });
      const user = await users.authUsers.create({ email: 'reset@example.com', name: 'Reset' });
      await new PasswordCredentialRepositoryAdapter(dataSource.getRepository(PasswordCredentialEntity))
        .create({ userId: user.id, passwordHash: 'old-hash' });
      const token = randomUUID();
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const tokens = dataSource.getRepository(PasswordResetTokenEntity);
      await tokens.insert({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60_000) });
      const auth = createAuthModule({
        dataSource,
        users: users.authUsers,
        access: users.access,
        profiles: users.profiles
      });
      const api = request(createApiApp({ authRouter: auth.router, eventsRouter: express.Router() }));
      const accessToken = await new JwtTokenService().signAccessToken({ userId: user.id });
      const reset = (password: string) =>
        api.post('/api/v1/auth/password-reset').send({ token, password });

      await reset('я'.repeat(40)).expect(400);
      expect(await tokens.findOneBy({ tokenHash })).not.toBeNull();
      await reset('New Password 123').expect(200);
      expect(await tokens.findOneBy({ tokenHash })).toBeNull();
      await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    });

    it('checks cookie origins, requires Passkey enrollment proof and invalidates old access tokens', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const users = createUsersModule({ dataSource });
      const user = await users.authUsers.create({ email: 'step-up@example.com', name: 'Step up' });
      const auth = createAuthModule({
        dataSource,
        users: users.authUsers,
        access: users.access,
        profiles: users.profiles
      });
      const api = request(createApiApp({ authRouter: auth.router, eventsRouter: express.Router() }));
      const token = await new JwtTokenService().signAccessToken({ userId: user.id });
      const bearer = `Bearer ${token}`;
      await api.post('/api/v1/auth/logout-all')
        .set('Cookie', `accessToken=${token}`)
        .set('Origin', 'https://untrusted.example')
        .expect(403);
      await api.post('/api/v1/auth/passkey/registration/options')
        .set('Authorization', bearer).send({}).expect(400);
      await api.post('/api/v1/auth/logout-all').set('Authorization', bearer).expect(200);
      await api.get('/api/v1/auth/me').set('Authorization', bearer).expect(401);
    });

    it('rotates a refresh session once and revokes only its family on replay', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const users = createUsersModule({ dataSource });
      const user = await users.authUsers.create({ email: 'rotation@example.com', name: 'Rotation' });
      const sessions = new RefreshSessionRepositoryAdapter(dataSource.getRepository(RefreshSessionEntity));
      const makeSession = () => ({
        id: randomUUID(),
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000)
      });
      const original = makeSession();
      const unrelated = makeSession();
      await sessions.create(original);
      await sessions.create(unrelated);
      const replacements = [makeSession(), makeSession()];
      const rotated = await Promise.all(
        replacements.map((replacement) => sessions.rotate(original.id, replacement))
      );
      expect(rotated.filter(Boolean)).toHaveLength(1);
      expect(await sessions.findById(original.id)).toMatchObject({
        rotatedAt: expect.any(Date),
        familyId: original.id
      });
      await sessions.revokeFamily(user.id, original.id);
      expect((await sessions.findById(replacements[rotated.indexOf(true)].id))?.revokedAt).toBeInstanceOf(Date);
      expect((await sessions.findById(unrelated.id))?.revokedAt).toBeNull();

      await sessions.revokeAllByUserId(user.id);
      expect((await users.authUsers.findById(user.id))?.sessionVersion).toEqual(expect.any(String));
      expect((await sessions.findById(unrelated.id))?.revokedAt).toBeInstanceOf(Date);
    });

    it('shares auth rate limits between independent middleware instances', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const key = randomUUID();
      const createApp = () => {
        const app = express();
        app.post('/', createSharedAuthRateLimit(dataSource)('test', 1, 60_000, () => key),
          (_req, res) => res.status(204).end());
        return app;
      };
      await request(createApp()).post('/').expect(204);
      await request(createApp()).post('/').expect(429);
    });

    it('creates and finds user by id and email via UserRepositoryAdapter', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const userRepo = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));

      const created = await userRepo.create({
        email: 'adapter@example.com',
        name: 'Adapter User'
      });

      expect(created.id).toBeDefined();
      expect(created.email).toBe('adapter@example.com');

      const byId = await userRepo.findById(created.id);
      expect(byId?.email).toBe('adapter@example.com');

      const byEmail = await userRepo.findByEmail('adapter@example.com');
      expect(byEmail?.id).toBe(created.id);
    });

    it('creates user with pre-generated custom UUID', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const userRepo = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));
      const customId = randomUUID();

      const created = await userRepo.create({
        id: customId,
        email: 'custom-id@example.com',
        name: 'Custom Id User'
      });

      expect(created.id).toBe(customId);

      const found = await userRepo.findById(customId);
      expect(found?.id).toBe(customId);
    });

    it('atomically creates User + PasswordCredential via TypeOrmRegistrationTransaction and rolls back on duplicate email', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const transaction = new TypeOrmRegistrationTransaction(dataSource, createUsersModule({ dataSource }).authUsers);

      const user = await transaction.createUserWithPasswordCredential({
        email: 'transaction-pwd@example.com',
        name: 'Tx User',
        passwordHash: 'hash-value'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('transaction-pwd@example.com');

      const pwdRepo = new PasswordCredentialRepositoryAdapter(
          dataSource.getRepository(PasswordCredentialEntity)
      );
      const cred = await pwdRepo.findByUserId(user.id);
      expect(cred?.passwordHash).toBe('hash-value');

      await expect(
          transaction.createUserWithPasswordCredential({
            email: 'transaction-pwd@example.com',
            name: 'Another User',
            passwordHash: 'another-hash'
          })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email already registered'
      });
    });

    it('atomically creates User + GoogleCredential via TypeOrmGoogleLoginTransaction', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const transaction = new TypeOrmGoogleLoginTransaction(dataSource, createUsersModule({ dataSource }).authUsers);

      const user = await transaction.createUserWithGoogleCredential({
        email: 'tx-google@gmail.com',
        name: 'Google Tx',
        googleSub: 'sub-tx-12345'
      });

      expect(user.id).toBeDefined();
      expect(user.emailVerified).toBe(true);

      const googleRepo = new GoogleCredentialRepositoryAdapter(
          dataSource.getRepository(GoogleCredentialEntity)
      );
      const cred = await googleRepo.findByGoogleSub('sub-tx-12345');
      expect(cred?.userId).toBe(user.id);

      await expect(
          transaction.createUserWithGoogleCredential({
            email: 'different-email@gmail.com',
            name: 'Different',
            googleSub: 'sub-tx-12345'
          })
      ).rejects.toMatchObject({
        statusCode: 409
      });
    });

    it('atomically creates User + PasskeyCredential with pre-generated UUID via TypeOrmPasskeySignupTransaction', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const transaction = new TypeOrmPasskeySignupTransaction(dataSource, createUsersModule({ dataSource }).authUsers);
      const preGeneratedUserId = randomUUID();

      const user = await transaction.createUserWithPasskeyCredential({
        userId: preGeneratedUserId,
        email: 'passkey-tx@example.com',
        name: 'Passkey Tx',
        credential: {
          credentialId: 'tx-passkey-cred-id',
          publicKey: Buffer.from('tx-pubkey'),
          counter: '0',
          transports: ['internal'],
          backedUp: true
        }
      });

      expect(user.id).toBe(preGeneratedUserId);

      const passkeyRepo = new PasskeyCredentialRepositoryAdapter(
          dataSource.getRepository(PasskeyCredentialEntity)
      );
      const cred = await passkeyRepo.findByCredentialId('tx-passkey-cred-id');
      expect(cred?.userId).toBe(preGeneratedUserId);
      expect(cred?.counter).toBe('0');

      await expect(
        passkeyRepo.create({
          userId: user.id,
          credentialId: 'tx-passkey-cred-id',
          publicKey: Buffer.from('tx-pubkey'),
          counter: '0',
          transports: ['internal'],
          backedUp: true
        })
      ).rejects.toMatchObject({ statusCode: 409, message: 'Passkey already registered' });
    });

    it('PasskeyChallengeRepository: create, atomic consume, single-use check, and expiry', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const challengeRepo = new PasskeyChallengeRepositoryAdapter(
          dataSource.getRepository(PasskeyChallengeEntity)
      );

      await challengeRepo.create({
        challenge: 'atomic-test-challenge-1',
        type: 'SIGNUP',
        email: 'challenge@example.com',
        name: 'Challenge User',
        expiresAt: new Date(Date.now() + 60000)
      });

      const consumed = await challengeRepo.consume({
        challenge: 'atomic-test-challenge-1',
        type: 'SIGNUP'
      });

      expect(consumed).toBeDefined();
      expect(consumed?.challenge).toBe('atomic-test-challenge-1');
      expect(consumed?.email).toBe('challenge@example.com');

      const secondConsume = await challengeRepo.consume({
        challenge: 'atomic-test-challenge-1',
        type: 'SIGNUP'
      });
      expect(secondConsume).toBeNull();

      await challengeRepo.create({
        challenge: 'expired-challenge-xyz',
        type: 'AUTHENTICATION',
        expiresAt: new Date(Date.now() - 1000)
      });

      const expiredConsume = await challengeRepo.consume({
        challenge: 'expired-challenge-xyz',
        type: 'AUTHENTICATION'
      });
      expect(expiredConsume).toBeNull();
    });

    it('cascades deletion from users table to all credentials (ON DELETE CASCADE)', async (ctx) => {
      if (!dbAvailable) ctx.skip();

      const userRepo = new UserRepositoryAdapter(dataSource.getRepository(UserEntity));
      const pwdRepo = new PasswordCredentialRepositoryAdapter(
          dataSource.getRepository(PasswordCredentialEntity)
      );

      const user = await userRepo.create({
        email: 'cascade-test@example.com',
        name: 'Cascade Test'
      });

      await pwdRepo.create({
        userId: user.id,
        passwordHash: 'some-hash'
      });

      const credBefore = await pwdRepo.findByUserId(user.id);
      expect(credBefore).toBeDefined();

      await dataSource.getRepository(UserEntity).delete(user.id);

      const credAfter = await pwdRepo.findByUserId(user.id);
      expect(credAfter).toBeNull();
    });
  });
});
