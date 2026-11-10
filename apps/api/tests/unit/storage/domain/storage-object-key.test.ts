import { describe, it, expect } from 'vitest';
import {
    StorageObjectKey,
    InvalidStorageKeyError
} from '../../../../src/modules/storage/domain/index.js';

describe('StorageObjectKey', () => {
    it('creates a key from a valid value', () => {
        const key = StorageObjectKey.create('avatars/user-1/photo.jpg');
        expect(key.value).toBe('avatars/user-1/photo.jpg');
    });

    it('accepts keys with dots, dashes, underscores and slashes', () => {
        const key = StorageObjectKey.create('events/2026/my-event_poster.v2.png');
        expect(key.value).toBe('events/2026/my-event_poster.v2.png');
    });

    it('rejects an empty string', () => {
        expect(() => StorageObjectKey.create('')).toThrow(InvalidStorageKeyError);
    });

    it('rejects a non-string value', () => {
        expect(() => StorageObjectKey.create(undefined as unknown as string)).toThrow(
            InvalidStorageKeyError
        );
    });

    it('rejects keys longer than 1024 characters', () => {
        expect(() => StorageObjectKey.create('a'.repeat(1025))).toThrow(InvalidStorageKeyError);
    });

    it('rejects keys containing ".."', () => {
        expect(() => StorageObjectKey.create('avatars/../secrets')).toThrow(
            InvalidStorageKeyError
        );
    });

    it('rejects keys starting with a slash', () => {
        expect(() => StorageObjectKey.create('/avatars/user-1/photo.jpg')).toThrow(
            InvalidStorageKeyError
        );
    });

    it('rejects keys with invalid characters', () => {
        expect(() => StorageObjectKey.create('avatars/user 1/photo.jpg')).toThrow(
            InvalidStorageKeyError
        );
    });

    it('rejects keys containing "@"', () => {
        expect(() => StorageObjectKey.create('user@gmail.com/avatars/photo.jpg')).toThrow(
            InvalidStorageKeyError
        );
    });
});