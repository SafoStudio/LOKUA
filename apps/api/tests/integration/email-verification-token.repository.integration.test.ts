import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import {
    createTestDataSource,
    isDatabaseReachable,
    clearAllTables
} from './helpers/test-db.js';
import {
    EmailVerificationTokenEntity,
    EmailVerificationTokenRepositoryAdapter
} from '../../src/modules/auth/infrastructure/index.js';

const USER_1 = '11111111-1111-1111-1111-111111111111';

const dataSource: DataSource = createTestDataSource();
const dbAvailable = await isDatabaseReachable(createTestDataSource());

describe.skipIf(!dbAvailable)('EmailVerificationTokenRepositoryAdapter', () => {
    let repository: EmailVerificationTokenRepositoryAdapter;

    beforeAll(async () => {
        await dataSource.initialize();
        repository = new EmailVerificationTokenRepositoryAdapter(
            dataSource.getRepository(EmailVerificationTokenEntity)
        );
    });

    afterAll(async () => {
        if (dataSource.isInitialized) await dataSource.destroy();
    });

    beforeEach(async () => {
        await clearAllTables(dataSource);
        await dataSource.query(
            `INSERT INTO "users" ("id", "email", "name", "email_verified") VALUES ($1, $2, $3, $4)`,
            [USER_1, 'user@example.com', 'User', false]
        );
    });

    it('creates token and consumes it once', async () => {
        const hash = 'a'.repeat(64);
        await repository.create({
            userId: USER_1,
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 60_000)
        });

        const consumed = await repository.consumeByHash(hash);
        expect(consumed).not.toBeNull();
        expect(consumed!.userId).toBe(USER_1);
        expect(consumed!.tokenHash).toBe(hash);

        const second = await repository.consumeByHash(hash);
        expect(second).toBeNull();
    });

    it('returns null for expired token and leaves the row', async () => {
        const hash = 'b'.repeat(64);
        await repository.create({
            userId: USER_1,
            tokenHash: hash,
            expiresAt: new Date(Date.now() - 1000)
        });

        const consumed = await repository.consumeByHash(hash);
        expect(consumed).toBeNull();

        const rows = await dataSource.query(
            `SELECT COUNT(*)::int AS c FROM "email_verification_tokens"`
        );
        expect(rows[0].c).toBe(1);
    });

    it('returns null for unknown hash', async () => {
        const consumed = await repository.consumeByHash('c'.repeat(64));
        expect(consumed).toBeNull();
    });

    it('enforces unique token_hash', async () => {
        const hash = 'd'.repeat(64);
        await repository.create({
            userId: USER_1,
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 60_000)
        });

        await expect(
            repository.create({
                userId: USER_1,
                tokenHash: hash,
                expiresAt: new Date(Date.now() + 60_000)
            })
        ).rejects.toThrow();
    });

    it('cascades on user delete', async () => {
        await repository.create({
            userId: USER_1,
            tokenHash: 'e'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await dataSource.query(`DELETE FROM "users" WHERE id = $1`, [USER_1]);

        const rows = await dataSource.query(
            `SELECT COUNT(*)::int AS c FROM "email_verification_tokens"`
        );
        expect(rows[0].c).toBe(0);
    });
});