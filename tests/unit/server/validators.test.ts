import { describe, expect, it } from "vitest";
import { SEED } from "@/content/seed";
import { COLLECTIONS, VALIDATORS } from "@/server/db/validators";

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
