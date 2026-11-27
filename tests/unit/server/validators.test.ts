import { describe, expect, it } from "vitest";
import { SEED } from "@/content/seed";
import { z } from "zod";
import { SettingsSchema, ZoneSchema } from "@/content/schema";
import { COLLECTIONS, PATTERNS, VALIDATORS } from "@/server/db/validators";

type Schema = { additionalProperties: boolean; required: string[] };
const schemaOf = (k: keyof typeof COLLECTIONS) =>
  (VALIDATORS[k] as { $jsonSchema: Schema }).$jsonSchema;

describe("VALIDATORS", () => {
  it("forbids additional properties on every collection", () => {
    for (const k of Object.keys(COLLECTIONS) as (keyof typeof COLLECTIONS)[]) {
      expect(schemaOf(k).additionalProperties).toBe(false);
    }
  });

  it("seed documents satisfy each required list", () => {
    const docs = {
      settings: [{ _id: "site", ...SEED.settings }],
      zones: SEED.zones.map((z) => ({ _id: z.id, ...z })),
      prices: SEED.prices.map((p) => ({ _id: p.id, ...p })),
    };
    for (const k of Object.keys(docs) as (keyof typeof docs)[]) {
      for (const d of docs[k]) {
        for (const r of schemaOf(k).required) expect(d).toHaveProperty(r);
      }
    }
  });
});

describe("PATTERNS mirror the zod rules", () => {
  // JS has no \z; without the m flag `$` is equivalent
  const js = (p: string) => new RegExp(p.replace(/\\z/g, "$"));
  const cases: [keyof typeof PATTERNS, z.ZodType, string[], string[]][] = [
    [
      "openingAt",
      SettingsSchema.shape.openingAt,
      ["2026-12-12T09:00:00+05:30", "2026-12-12T09:00:00Z", "2026-12-12T09:00:00.5-08:00", "2028-02-29T00:00:00Z"],
      ["next friday", "2026-12-12", "2026-12-12T09:00:00", "2026-13-01T00:00:00Z", "2027-02-29T00:00:00Z", "2026-12-12 09:00:00Z", "2026-12-12T25:00:00Z", "2026-12-12T09:00:00Z\n", ""],
    ],
    ["time", SettingsSchema.shape.hours.shape.opens, ["09:00", "23:59", "00:00"], ["9:00", "24:00", "09:60", "09:00\n", "", "9am"]],
    ["whatsapp", SettingsSchema.shape.whatsapp, ["+919945205694", "+14155552671"], ["919945205694", "+0123456", "+12345", "+91 99452", "+919945205694\n", ""]],
    ["instagram", SettingsSchema.shape.instagram, ["bisaat.club", "a_b.1"], ["@bisaat", "a b", "a-b", "", "ab\n"]],
    [
      "httpsUrl",
      SettingsSchema.shape.mapsUrl,
      ["https://maps.app.goo.gl/abc", "https://www.google.com/maps?q=1#x", "https://wa.me"],
      ["http://example.com", "javascript:alert(1)", "https://", "https:// x", "//evil.com", "/path", "ftp://x.y", "", "data:text/html,hi"],
    ],
    [
      "bookingUrl",
      SettingsSchema.shape.bookingUrl,
      ["https://wa.me/919945205694?text=hi", "/book", "/", "/a/b?c=d#e"],
      ["javascript:alert(1)", "//evil.com", "/\\evil.com", "http://x.y", "book", "", "https://", "/a b", "/a\n", "data:text/html,hi"],
    ],
    ["zoneId", ZoneSchema.shape.id, ["ps5", "door", "a1"], ["", "5ps", "PS5", "a-b", "a b", "ps5\n"]],
  ];
  for (const [name, schema, good, bad] of cases) {
    it(`${name}: zod and the Mongo pattern agree`, () => {
      const re = js(PATTERNS[name]);
      for (const s of good) {
        expect(schema.safeParse(s).success, `zod accepts ${JSON.stringify(s)}`).toBe(true);
        expect(re.test(s), `pattern accepts ${JSON.stringify(s)}`).toBe(true);
      }
      for (const s of bad) {
        expect(schema.safeParse(s).success, `zod rejects ${JSON.stringify(s)}`).toBe(false);
        expect(re.test(s), `pattern rejects ${JSON.stringify(s)}`).toBe(false);
      }
    });
  }

  it("seed values satisfy every pattern", () => {
    const re = (k: keyof typeof PATTERNS) => js(PATTERNS[k]);
    expect(re("openingAt").test(SEED.settings.openingAt)).toBe(true);
    expect(re("bookingUrl").test(SEED.settings.bookingUrl)).toBe(true);
    expect(re("httpsUrl").test(SEED.settings.mapsUrl)).toBe(true);
    for (const z of SEED.zones) expect(re("zoneId").test(z.id)).toBe(true);
  });
});
