import { z } from 'zod';

const normalizedId = z.uuid().transform((id) => id.toLowerCase());

export const dateOfBirthSchema = z.object({
  birthDate: z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`))
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  mainPhotoUrl: z.url().max(2048)
});

export const citySchema = z.object({
  cityId: normalizedId
});

export const interestsSchema = z.object({
  interestIds: z
    .array(normalizedId)
    .min(3, 'At least 3 interests required')
    .max(20, 'Maximum 20 interests allowed')
});

export const optionalProfileSchema = z
  .object({
    bio: z.string().trim().max(300).nullable().optional(),
    languages: z.array(z.string().trim().min(1).max(10)).nullable().optional(),
    socialLinks: z
      .record(z.string(), z.url({ protocol: /^https?$/ }))
      .nullable()
      .optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one optional field required'
  });

export type DateOfBirthInput = z.infer<typeof dateOfBirthSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type CityInput = z.infer<typeof citySchema>;
export type InterestsInput = z.infer<typeof interestsSchema>;
export type OptionalProfileInput = z.infer<typeof optionalProfileSchema>;
