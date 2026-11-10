import { describe, it, expect } from 'vitest';
import {
    InvalidStorageKeyError,
    InvalidSignedUrlTtlError,
    InvalidContentTypeError,
    EmptyUploadError,
    UploadTooLargeError
} from '../../../../src/modules/storage/domain/index.js';
import { AppError } from '../../../../src/common/index.js';

describe('storage domain errors', () => {
    it('InvalidStorageKeyError is AppError with 400 and operational', () => {
        const error = new InvalidStorageKeyError('bad');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('InvalidStorageKeyError');
    });

    it('InvalidSignedUrlTtlError is AppError with 400 and operational', () => {
        const error = new InvalidSignedUrlTtlError('bad');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('InvalidSignedUrlTtlError');
    });

    it('InvalidContentTypeError is AppError with 400 and operational', () => {
        const error = new InvalidContentTypeError('bad');
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('InvalidContentTypeError');
    });

    it('EmptyUploadError is AppError with 400 and operational', () => {
        const error = new EmptyUploadError();
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('EmptyUploadError');
        expect(error.message).toBe('Upload body must not be empty');
    });

    it('UploadTooLargeError is AppError with 413 and operational', () => {
        const error = new UploadTooLargeError(20, 10);
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(413);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('UploadTooLargeError');
        expect(error.message).toContain('20');
        expect(error.message).toContain('10');
    });
});