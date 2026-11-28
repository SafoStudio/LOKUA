import { z } from 'zod';
import { eventText } from './event-text.schema.js';

const eventDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const optionalNullableUrl = z
  .string()
  .trim()
  .pipe(z.union([z.url(), z.literal('')]))
  .nullable()
  .optional();

export const createEventSchema = z
  .object({
    title: eventText(3, 100),
    categoryId: z.uuid(),
    tags: z
      .array(eventText(1, 30).transform((value) => value.toLowerCase()))
      .max(10)
      .optional(),
    description: eventText(1, 10_000),

    coverUrl: optionalNullableUrl,
    mediaUrls: z.array(z.url()).max(5).optional(),

    format: z.enum(['OFFLINE', 'ONLINE']),
    primaryLocationId: z.uuid().nullable().optional(),
    onlineUrl: optionalNullableUrl,
    hideExactAddress: z.boolean().optional(),

    capacityLimit: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
    participationMode: z.enum(['FREE', 'REQUEST']),
    ageRestriction: z.enum(['ALL', 'SIXTEEN_PLUS', 'EIGHTEEN_PLUS']),

    isFree: z.boolean(),
    priceText: eventText(1, 100).nullable().optional(),
    itemsToBring: eventText(0, 500).nullable().optional(),

    firstStartsAt: eventDate.nullable().optional(),
    firstEndsAt: eventDate.nullable().optional(),
    timezone: eventText(1, 64).optional()
  })
  .strict();

export type CreateEventSchema = z.infer<typeof createEventSchema>;
