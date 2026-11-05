import { AppError } from './app-error.js';

export function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(`Missing or invalid ${name}`, 400);
  }
  return value;
}

export function assertNumber(value: unknown, name: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) {
    throw new AppError(`Missing or invalid ${name}`, 400);
  }
  return num;
}

export function assertDefined<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) {
    throw new AppError(`Missing ${name}`, 400);
  }
  return value;
}
