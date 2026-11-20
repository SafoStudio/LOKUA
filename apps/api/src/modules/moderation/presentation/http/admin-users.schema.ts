import { z } from 'zod';

export const changeBirthDateSchema = z.object({
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date'),
  reason: z.string().min(1).max(500)
});

export type ChangeBirthDateInput = z.infer<typeof changeBirthDateSchema>;
