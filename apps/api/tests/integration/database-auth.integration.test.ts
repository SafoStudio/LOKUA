import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { createTestDataSource, clearAllTables, TEST_DATABASE_URL } from './helpers/test-db.js';
import { UserEntity, UserRepositoryAdapter } from '../../src/modules/users/infrastructure/index.js';
import {
  PasswordCredentialEntity,
  PasswordCredentialRepositoryAdapter,
  GoogleCredentialEntity,
  GoogleCredentialRepositoryAdapter,
  PasskeyCredentialEntity,
  PasskeyCredentialRepositoryAdapter,
  PasskeyChallengeEntity,
  PasskeyChallengeRepositoryAdapter,
  TypeOrmRegistrationTransaction,
  TypeOrmGoogleLoginTransaction,
  TypeOrmPasskeySignupTransaction,
} from '../../src/modules/auth/infrastructure/index.js';
import { randomUUID } from 'node:crypto';

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

      const transaction = new TypeOrmRegistrationTransaction(dataSource);

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

      const transaction = new TypeOrmGoogleLoginTransaction(dataSource);

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

      const transaction = new TypeOrmPasskeySignupTransaction(dataSource);
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