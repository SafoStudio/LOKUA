import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import {
    createTestDataSource,
    isDatabaseReachable,
    clearAllTables
} from './helpers/test-db.js';
import {
    SecurityEventEntity,
    SecurityEventRepositoryAdapter
} from '../../src/modules/auth/infrastructure/index.js';

const USER_1 = '11111111-1111-1111-1111-111111111111';

const dataSource: DataSource = createTestDataSource();
const dbAvailable = await isDatabaseReachable(createTestDataSource());

describe.skipIf(!dbAvailable)('SecurityEventRepositoryAdapter', () => {
    let repository: SecurityEventRepositoryAdapter;

    beforeAll(async () => {
        await dataSource.initialize();
        repository = new SecurityEventRepositoryAdapter(
            dataSource.getRepository(SecurityEventEntity)
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

    it('records event with user and metadata', async () => {
        await repository.record({
            userId: USER_1,
            eventType: 'LOGIN_SUCCESS',
            ip: '203.0.113.1',
            userAgent: 'Mozilla/5.0',
            metadata: { method: 'password' }
        });

        const rows = await dataSource.query(
            `SELECT user_id, event_type, ip, user_agent, metadata FROM "security_events"`
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(USER_1);
        expect(rows[0].event_type).toBe('LOGIN_SUCCESS');
        expect(rows[0].ip).toBe('203.0.113.1');
        expect(rows[0].user_agent).toBe('Mozilla/5.0');
        expect(rows[0].metadata).toEqual({ method: 'password' });
    });

    it('records anonymous event with null userId', async () => {
        await repository.record({
            userId: null,
            eventType: 'LOGIN_FAILURE',
            ip: null,
            userAgent: null
        });

        const rows = await dataSource.query(
            `SELECT user_id, metadata FROM "security_events"`
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBeNull();
        expect(rows[0].metadata).toBeNull();
    });

    it('does not throw when database write fails', async () => {
        await dataSource.query(`ALTER TABLE "security_events" RENAME TO "security_events_bak"`);

        try {
            await expect(
                repository.record({
                    userId: USER_1,
                    eventType: 'LOGIN_SUCCESS',
                    ip: null,
                    userAgent: null
                })
            ).resolves.toBeUndefined();
        } finally {
            await dataSource.query(`ALTER TABLE "security_events_bak" RENAME TO "security_events"`);
        }
    });

    it('survives user deletion (no cascade)', async () => {
        await repository.record({
            userId: USER_1,
            eventType: 'LOGIN_SUCCESS',
            ip: null,
            userAgent: null
        });

        await dataSource.query(`DELETE FROM "users" WHERE id = $1`, [USER_1]);

        const rows = await dataSource.query(
            `SELECT user_id FROM "security_events"`
        );
        expect(rows).toHaveLength(1);
    });
});