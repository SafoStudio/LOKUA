import { z } from 'zod';

export const eventText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !value.includes('\0'), 'Null characters are not allowed');
