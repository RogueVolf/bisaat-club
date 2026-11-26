import { z } from "zod";

export const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;
export const DayOfWeekSchema = z.enum(DAYS);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const httpsUrl = z.url({ protocol: /^https$/ });
const bookingUrl = z.union([
  httpsUrl,
  z.string().regex(/^\/(?!\/)\S*$/, "must be an https URL or a site path"),
]);

export const SettingsSchema = z
  .object({
    openingAt: z.iso.datetime({ offset: true }),
    timezone: z.literal("Asia/Kolkata"),
    hours: z
      .object({ opens: time, closes: time, days: z.array(DayOfWeekSchema).min(1) })
      .strict(),
    hoursText: z.string(),
    address: z
      .object({
        line1: z.string(),
        street: z.string(),
        locality: z.string(),
        city: z.string(),
        region: z.string(),
        postalCode: z.string().optional(),
        country: z.literal("IN"),
      })
      .strict(),
    shortAddress: z.string(),
    whatsapp: z.string().regex(/^\+[1-9]\d{6,14}$/),
    instagram: z.string().regex(/^[A-Za-z0-9._]+$/),
    bookingUrl,
    bookingLabel: z.string().min(1),
    mapsUrl: httpsUrl,
  })
  .strict();

export const ZoneSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9]*$/),
    order: z.number().int().min(0),
    kicker: z.string(),
    title: z.string(),
    body: z.string(),
    price: z.string(),
    spotLabel: z.string().nullable(),
    cam: z.tuple([z.number(), z.number()]),
    yaw: z.number(),
    pitch: z.number(),
    at: z.tuple([z.number(), z.number(), z.number()]).nullable(),
  })
  .strict();

export const PriceItemSchema = z
  .object({
    id: z.string().min(1),
    item: z.string(),
    weekdayRate: z.number().int().nullable(),
    weekendRate: z.number().int().nullable(),
    unit: z.enum(["hour", "30 days", "session", "free"]),
    note: z.string(),
    order: z.number().int().min(0),
  })
  .strict();

const unique = (ids: string[]) => new Set(ids).size === ids.length;

export const SiteContentSchema = z
  .object({
    settings: SettingsSchema,
    zones: z.array(ZoneSchema),
    prices: z.array(PriceItemSchema),
  })
  .strict()
  .refine((c) => unique(c.zones.map((z) => z.id)), {
    message: "zone ids must be unique",
    path: ["zones"],
  })
  .refine((c) => unique(c.prices.map((p) => p.id)), {
    message: "price ids must be unique",
    path: ["prices"],
  });

export type Settings = z.infer<typeof SettingsSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type PriceItem = z.infer<typeof PriceItemSchema>;
export type SiteContent = { settings: Settings; zones: Zone[]; prices: PriceItem[] };
