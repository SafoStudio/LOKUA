import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import {
    createTestDataSource,
    isDatabaseReachable,
    clearAllTables
} from './helpers/test-db.js';
import {
    RefreshSessionEntity,
    RefreshSessionRepositoryAdapter
} from '../../src/modules/auth/infrastructure/index.js';

const USER_1 = '11111111-1111-1111-1111-111111111111';
const USER_2 = '22222222-2222-2222-2222-222222222222';
const SESSION_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SESSION_3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SESSION_MISSING = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const dataSource: DataSource = createTestDataSource();
const dbAvailable = await isDatabaseReachable(createTestDataSource());

describe.skipIf(!dbAvailable)('RefreshSessionRepositoryAdapter', () => {
    let repository: RefreshSessionRepositoryAdapter;

    beforeAll(async () => {
        await dataSource.initialize();
        repository = new RefreshSessionRepositoryAdapter(
            dataSource.getRepository(RefreshSessionEntity)
        );
    });

    afterAll(async () => {
        if (dataSource.isInitialized) await dataSource.destroy();
    });

    beforeEach(async () => {
        await clearAllTables(dataSource);
        await dataSource.query(
            `INSERT INTO "users" ("id", "email", "name", "email_verified") VALUES ($1, $2, $3, $4)`,
            [USER_1, 'user@example.com', 'User', true]
        );
    });

    it('creates and finds session by id', async () => {
        const expiresAt = new Date(Date.now() + 60_000);

        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'a'.repeat(64),
            expiresAt
        });

        const found = await repository.findById(SESSION_1);

        expect(found).not.toBeNull();
        expect(found!.id).toBe(SESSION_1);
        expect(found!.userId).toBe(USER_1);
        expect(found!.tokenHash).toBe('a'.repeat(64));
        expect(found!.revokedAt).toBeNull();
    });

    it('returns null when session not found', async () => {
        const found = await repository.findById(SESSION_MISSING);
        expect(found).toBeNull();
    });

    it('revokes session by id', async () => {
        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'a'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await repository.revokeById(SESSION_1);

        const found = await repository.findById(SESSION_1);
        expect(found!.revokedAt).not.toBeNull();
    });

    it('revokes session by token hash', async () => {
        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'b'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await repository.revokeByTokenHash('b'.repeat(64));

        const found = await repository.findById(SESSION_1);
        expect(found!.revokedAt).not.toBeNull();
    });

    it('revokeByTokenHash is idempotent and does not overwrite revokedAt', async () => {
        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'c'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await repository.revokeByTokenHash('c'.repeat(64));
        const first = await repository.findById(SESSION_1);
        const firstRevokedAt = first!.revokedAt!.getTime();

        await new Promise((r) => setTimeout(r, 10));
        await repository.revokeByTokenHash('c'.repeat(64));
        const second = await repository.findById(SESSION_1);

        expect(second!.revokedAt!.getTime()).toBe(firstRevokedAt);
    });

    it('revokeAllByUserId revokes only active sessions of that user', async () => {
        await dataSource.query(
            `INSERT INTO "users" ("id", "email", "name", "email_verified") VALUES ($1, $2, $3, $4)`,
            [USER_2, 'other@example.com', 'Other', true]
        );

        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'd'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });
        await repository.create({
            id: SESSION_2,
            userId: USER_1,
            tokenHash: 'e'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });
        await repository.create({
            id: SESSION_3,
            userId: USER_2,
            tokenHash: 'f'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await repository.revokeAllByUserId(USER_1);

        const s1 = await repository.findById(SESSION_1);
        const s2 = await repository.findById(SESSION_2);
        const s3 = await repository.findById(SESSION_3);

        expect(s1!.revokedAt).not.toBeNull();
        expect(s2!.revokedAt).not.toBeNull();
        expect(s3!.revokedAt).toBeNull();
    });

    it('enforces unique token_hash', async () => {
        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'g'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await expect(
            repository.create({
                id: SESSION_2,
                userId: USER_1,
                tokenHash: 'g'.repeat(64),
                expiresAt: new Date(Date.now() + 60_000)
            })
        ).rejects.toThrow();
    });

    it('cascades on user delete', async () => {
        await repository.create({
            id: SESSION_1,
            userId: USER_1,
            tokenHash: 'h'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000)
        });

        await dataSource.query(`DELETE FROM "users" WHERE id = $1`, [USER_1]);

        const count = await dataSource.query(
            `SELECT COUNT(*)::int AS c FROM "refresh_sessions" WHERE id = $1`,
            [SESSION_1]
        );
        expect(count[0].c).toBe(0);
    });
});