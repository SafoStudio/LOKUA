import { z } from 'zod';

export const changeBirthDateSchema = z.strictObject({
  birthDate: z.iso.date(),
  reason: z.string().trim().min(1).max(500)
});

export type ChangeBirthDateInput = z.infer<typeof changeBirthDateSchema>;
