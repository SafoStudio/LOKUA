import type { ValueTransformer } from 'typeorm';

export const dateTransformer: ValueTransformer = {
  to: (value: Date | null): string | null => {
    if (!value) return null;
    if (!(value instanceof Date)) return null;
    return value.toISOString().slice(0, 10);
  },
  from: (value: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
};
