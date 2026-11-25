import { z } from 'zod';

const optionalNullableUrl = z
  .string()
  .trim()
  .pipe(z.union([z.url(), z.literal('')]))
  .nullable()
  .optional();

export const createEventSchema = z
  .object({
    title: z.string().trim().min(3).max(100),
    categoryId: z.uuid(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).optional(),
    description: z.string().trim().min(1),

    coverUrl: optionalNullableUrl,
    mediaUrls: z.array(z.url()).max(5).optional(),

    format: z.enum(['OFFLINE', 'ONLINE']),
    primaryLocationId: z.uuid().nullable().optional(),
    onlineUrl: optionalNullableUrl,
    hideExactAddress: z.boolean().optional(),

    capacityLimit: z.number().int().positive().nullable().optional(),
    participationMode: z.enum(['FREE', 'REQUEST']),
    ageRestriction: z.enum(['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS']),

    isFree: z.boolean(),
    priceText: z.string().trim().min(1).max(100).nullable().optional(),
    itemsToBring: z.string().trim().max(500).nullable().optional(),

    firstStartsAt: z.coerce.date().nullable().optional(),
    firstEndsAt: z.coerce.date().nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional()
  })
  .strict();

export type CreateEventSchema = z.infer<typeof createEventSchema>;
