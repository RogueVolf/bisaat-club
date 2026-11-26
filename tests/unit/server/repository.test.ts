import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED } from "@/content/seed";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
const getReadDb = vi.fn();
vi.mock("@/server/db/client", () => ({ getReadDb: () => getReadDb() }));

import { getSiteContent } from "@/server/content/repository";
import { assertTlsPolicy } from "@/server/db/tls";

function fakeDb(zones: unknown[], pricesOverride?: unknown[]) {
  const data: Record<string, unknown[]> = {
    settings: [{ _id: "site", ...SEED.settings }],
    zones,
    prices: pricesOverride ?? SEED.prices.map((p) => ({ _id: p.id, ...p })),
  };
  return {
    collection: (name: string) => ({ find: () => ({ toArray: async () => data[name] }) }),
  };
}
const seedZones = () => SEED.zones.map((z) => ({ _id: z.id, ...z }));

describe("getSiteContent", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    getReadDb.mockReset();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("falls back to SEED when the DB is unreachable", async () => {
    const err = new Error("secret mongodb://u:p@h/db");
    err.name = "MongoServerSelectionError";
    getReadDb.mockRejectedValue(err);
    const r = await getSiteContent();
    expect(r.source).toBe("fallback");
    expect(r.content).toEqual(SEED);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toBe("content: falling back to bundled seed (MongoServerSelectionError)");
    expect(line).not.toContain("mongodb://");
  });

  it("falls back when a zone has an unsafe key", async () => {
    const zones = seedZones();
    (zones[0] as Record<string, unknown>)["$where"] = "1";
    getReadDb.mockResolvedValue(fakeDb(zones));
    const r = await getSiteContent();
    expect(r.source).toBe("fallback");
    expect(r.content).toEqual(SEED);
  });

  it("falls back when zones are empty", async () => {
    getReadDb.mockResolvedValue(fakeDb([]));
    expect((await getSiteContent()).source).toBe("fallback");
  });

  it("falls back when prices are empty", async () => {
    getReadDb.mockResolvedValue(fakeDb(seedZones(), []));
    expect((await getSiteContent()).source).toBe("fallback");
  });

  it("returns DB content when valid", async () => {
    const zones = seedZones();
    zones[1] = { ...zones[1], title: "Changed title" } as (typeof zones)[number];
    getReadDb.mockResolvedValue(fakeDb(zones));
    const r = await getSiteContent();
    expect(r.source).toBe("db");
    expect(r.content.zones[1].title).toBe("Changed title");
    expect(r.content.zones[1]).not.toHaveProperty("_id");
  });
});

describe("assertTlsPolicy", () => {
  it("enforces TLS in production only", () => {
    expect(() => assertTlsPolicy("mongodb://h/db", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db?tls=true", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db?ssl=true", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb+srv://h/db", "production")).not.toThrow();
    expect(() => assertTlsPolicy("mongodb://h/db", "development")).not.toThrow();
  });
  it("rejects weakened TLS in production", () => {
    for (const q of [
      "tls=false", "ssl=false", "TLS=FALSE", "tls=true&tlsInsecure=true",
      "tls=true&tlsAllowInvalidCertificates=true", "tls=true&tlsAllowInvalidHostnames=true",
      "tlsinsecure=true",
    ]) {
      expect(() => assertTlsPolicy(`mongodb://h/db?${q}`, "production"), q).toThrow();
    }
    expect(() => assertTlsPolicy("mongodb+srv://h/db?tls=false", "production")).toThrow();
    expect(() => assertTlsPolicy("mongodb+srv://h/db?tlsInsecure=true", "production")).toThrow();
  });
  it("does not leak the URI", () => {
    const uri = "mongodb://user:pw@h/db";
    let message = "";
    expect(() => {
      try {
        assertTlsPolicy(uri, "production");
      } catch (e) {
        message = (e as Error).message;
        throw e;
      }
    }).toThrow();
    expect(message).not.toBe("");
    expect(message).not.toContain(uri);
    expect(message).not.toContain("pw");
  });
});
