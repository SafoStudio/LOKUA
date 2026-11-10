import { describe, it, expect } from 'vitest';
import {
    buildStorageKey,
    StorageObjectKey
} from '../../../../src/modules/storage/domain/index.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('buildStorageKey', () => {
    it('builds <entity>/<entityId>/<kind>/<uuid>.<ext>', () => {
        const key = buildStorageKey({
            entity: 'profiles',
            entityId: '5f2e1a3b-0000-4000-8000-000000000001',
            kind: 'avatars',
            extension: 'jpg'
        });

        const parts = key.split('/');
        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe('profiles');
        expect(parts[1]).toBe('5f2e1a3b-0000-4000-8000-000000000001');
        expect(parts[2]).toBe('avatars');
        const filePart = parts[3]!;
        const dotIndex = filePart.lastIndexOf('.');
        expect(dotIndex).toBeGreaterThan(0);
        expect(UUID_PATTERN.test(filePart.slice(0, dotIndex))).toBe(true);
        expect(filePart.slice(dotIndex + 1)).toBe('jpg');
    });

    it('produces a new uuid on every call', () => {
        const input = {
            entity: 'profiles',
            entityId: '5f2e1a3b-0000-4000-8000-000000000001',
            kind: 'avatars',
            extension: 'jpg'
        };
        const a = buildStorageKey(input);
        const b = buildStorageKey(input);
        expect(a).not.toBe(b);
    });

    it('produces a key accepted by StorageObjectKey', () => {
        const key = buildStorageKey({
            entity: 'events',
            entityId: '5f2e1a3b-0000-4000-8000-000000000002',
            kind: 'posters',
            extension: 'webp'
        });
        expect(() => StorageObjectKey.create(key)).not.toThrow();
    });

    it('rejects invalid entity', () => {
        expect(() =>
            buildStorageKey({
                entity: '',
                entityId: '5f2e1a3b-0000-4000-8000-000000000001',
                kind: 'avatars',
                extension: 'jpg'
            })
        ).toThrow();
        expect(() =>
            buildStorageKey({
                entity: 'Pro files',
                entityId: '5f2e1a3b-0000-4000-8000-000000000001',
                kind: 'avatars',
                extension: 'jpg'
            })
        ).toThrow();
    });

    it('rejects invalid entityId', () => {
        expect(() =>
            buildStorageKey({
                entity: 'profiles',
                entityId: '',
                kind: 'avatars',
                extension: 'jpg'
            })
        ).toThrow();
        expect(() =>
            buildStorageKey({
                entity: 'profiles',
                entityId: 'a/b',
                kind: 'avatars',
                extension: 'jpg'
            })
        ).toThrow();
    });

    it('rejects invalid kind', () => {
        expect(() =>
            buildStorageKey({
                entity: 'profiles',
                entityId: '5f2e1a3b-0000-4000-8000-000000000001',
                kind: '',
                extension: 'jpg'
            })
        ).toThrow();
    });

    it('rejects invalid extension', () => {
        expect(() =>
            buildStorageKey({
                entity: 'profiles',
                entityId: '5f2e1a3b-0000-4000-8000-000000000001',
                kind: 'avatars',
                extension: '.jpg'
            })
        ).toThrow();
        expect(() =>
            buildStorageKey({
                entity: 'profiles',
                entityId: '5f2e1a3b-0000-4000-8000-000000000001',
                kind: 'avatars',
                extension: 'j/pg'
            })
        ).toThrow();
    });
});